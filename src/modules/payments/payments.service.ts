import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PaymentType } from '../../common/enums/payment-type.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { SeylanMpgsService } from '../../infrastructure/seylan/seylan-mpgs.service';
import { PaymentMethod } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { isNumber } from 'class-validator';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private seylanMpgsService: SeylanMpgsService,
    private configService: ConfigService,
  ) {}

  /**
   * ADMIN: Returns total number of payments.
   * Used for analytics.
   */
  async getStats() {
    try {
      // GET THE GRAND TOTAL
      const totalCount = await this.prisma.payment.count();

      return { total: totalCount };
    } catch (error) {
      this.handleError('fetching payment stats', error);
    }
  }

  /**
   * Step 1: Create a secure record stub and calculate the gateway signature hash configuration
   */
  async initiatePaymentIntent(userId: string, data: CreatePaymentDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: { user: true, payments: true, tour: true },
    });

    if (!booking || booking.userId !== userId) {
      throw new NotFoundException(
        'The requested booking structure was not found.',
      );
    }

    // Business Logic Guard: Prevent paying if already fully paid
    const payments = (booking.payments || []) as any[];

    const totalPaid = payments
      .filter((p) => p.status === PaymentStatus.SUCCESS)
      .reduce((sum, p) => sum + p.amount, 0);

    if (totalPaid >= booking.totalAmount) {
      throw new BadRequestException(
        'This booking has already been fully paid.',
      );
    }

    // Generate a order id string to pass to the gateway
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const now = new Date();
    const timeStr = [
      String(now.getHours()).padStart(2, '0'),
      // String(now.getMinutes()).padStart(2, '0'),
      // String(now.getSeconds()).padStart(2, '0'),
    ].join('');

    const orderId = `TV-${String(booking.id).padStart(6, '0')}-${dateStr}-${timeStr}`;

    const gatewaySession = await this.seylanMpgsService.initiateCheckoutSession(
      orderId,
      data.amount,
      'USD',
      booking.tour.title,
    );

    return {
      sessionId: gatewaySession.session.id,
    };
  }

  /**
   * STEP 2: Securely capture payment feedback webhooks without causing unique constraint drops
   */
  async processWebhook(secret: string, payload: any) {
    this.verifyWebhookSecret(secret);

    const transactionType = payload.transaction?.type;

    // ⚠️ GUARD: Skip baseline check authentications
    if (transactionType === 'AUTHENTICATION') {
      return { status: 'ignored', message: 'Authentication event skipped' };
    }

    // Accept both regular payments and refund adjustments from MPGS
    if (transactionType !== 'PAYMENT' && transactionType !== 'REFUND') {
      return {
        status: 'ignored',
        message: `Unhandled transaction type context: ${transactionType}`,
      };
    }

    const internalOrderId = payload.order.id;
    const gatewayResult = payload.result;
    const transactionAmount =
      payload.transaction.amount ?? payload.order.amount;

    // Extract bookingId safely out of standard prefix template strings
    const orderIdParts = internalOrderId.split('-');
    const bookingId = parseInt(orderIdParts[1], 10);

    if (isNaN(bookingId)) {
      return {
        status: 'error',
        message: 'Malformed internal order structure string received.',
      };
    }

    // Determine targeted balance transactional status code mapping values
    let targetStatus: PaymentStatus = PaymentStatus.FAILED;
    if (gatewayResult === 'SUCCESS') {
      targetStatus =
        transactionType === 'REFUND'
          ? PaymentStatus.REFUNDED
          : PaymentStatus.SUCCESS;
    } else if (gatewayResult === 'PENDING') {
      targetStatus = PaymentStatus.PENDING;
    } else if (gatewayResult === 'FAILURE' || gatewayResult === 'ERROR') {
      targetStatus = PaymentStatus.FAILED;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Idempotency Check: Verify if this specific interaction has run before
        const existingPayment = await tx.payment.findFirst({
          where: { transactionId: internalOrderId },
        });

        if (existingPayment) {
          // If transaction is logged but status has changed, update it (useful for pending -> success/refund transitions)
          if (existingPayment.status !== targetStatus) {
            await tx.payment.update({
              where: { id: existingPayment.id },
              data: { status: targetStatus, gatewayData: payload as any },
            });
            await this.syncBookingStatus(tx, bookingId);
            return {
              status: 'acknowledged',
              message: 'Transaction status updated',
            };
          }
          return {
            status: 'acknowledged',
            message: 'Duplicate transaction skipped',
          };
        }

        // Handle structural payload updates for explicitly processed refunds
        if (transactionType === 'REFUND') {
          // Attempt to find the original capture payment record sharing this Order context
          const originalCapturePayment = await tx.payment.findFirst({
            where: {
              bookingId: bookingId,
              transactionId: { startsWith: `${internalOrderId}#` },
              status: PaymentStatus.SUCCESS,
            },
          });

          if (originalCapturePayment) {
            // Update the existing row to REFUNDED to balance out current reservation cards
            await tx.payment.update({
              where: { id: originalCapturePayment.id },
              data: {
                status: PaymentStatus.REFUNDED,
                gatewayData: {
                  ...(originalCapturePayment.gatewayData as Record<
                    string,
                    any
                  >),
                  webhookRefundLog: payload,
                },
              },
            });
          } else {
            const refundBooking = await tx.booking.findUnique({
              where: { id: bookingId },
            });
            if (!refundBooking) {
              throw new NotFoundException(
                `Booking with ID ${bookingId} not found.`,
              );
            }

            // If the original transaction log record isn't found locally, insert it as a tracking adjustment offset
            await tx.payment.create({
              data: {
                bookingId: bookingId,
                userId: refundBooking.userId,
                amount: transactionAmount,
                type: PaymentType.FULL,
                method: PaymentMethod.SEYLAN_MPGS,
                status: PaymentStatus.REFUNDED,
                transactionId: internalOrderId,
                gatewayData: payload as any,
              },
            });
          }
        } else {
          // Standard Capture Logic path sequence: PAYMENT actions
          const targetBooking = await tx.booking.findUnique({
            where: { id: bookingId },
            include: { payments: true },
          });

          if (!targetBooking) {
            throw new NotFoundException(
              `Booking contextual framework with ID ${bookingId} missing.`,
            );
          }

          const totalPaidPrior = targetBooking.payments
            .filter((p) => p.status === PaymentStatus.SUCCESS)
            .reduce((sum, p) => sum + p.amount, 0);

          const dynamicType =
            totalPaidPrior + transactionAmount >= targetBooking.totalAmount
              ? PaymentType.FULL
              : PaymentType.ADVANCE;

          await tx.payment.create({
            data: {
              bookingId: targetBooking.id,
              userId: targetBooking.userId,
              amount: transactionAmount,
              type: dynamicType,
              method: PaymentMethod.SEYLAN_MPGS,
              status: targetStatus,
              transactionId: internalOrderId,
              gatewayData: payload as any,
            },
          });
        }

        // Run dynamic verification to balance out tracking metrics safely
        await this.syncBookingStatus(tx, bookingId);

        return { status: 'acknowledged' };
      });
    } catch (error) {
      this.logger.error(
        `Webhook sync execution failure: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new BadRequestException('Data layer sequence adjustment failure.');
    }
  }

  async findAll(query: QueryPaymentDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 12;

    const skip = (page - 1) * limit;

    // BUILD DYNAMIC FILTER OBJECT
    const where: Prisma.PaymentWhereInput = {
      ...(query.search && {
        OR: [
          { id: { equals: Number(query.search) || 0 } },
          { bookingId: { equals: Number(query.search) || 0 } },
          { transactionId: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
      ...(query.type && { type: query.type }),
      ...(query.status && { status: query.status }),
      ...((query.minAmount || query.maxAmount) && {
        amount: {
          ...(query.minAmount && { gte: Number(query.minAmount) }),
          ...(query.maxAmount && { lte: Number(query.maxAmount) }),
        },
      }),
      ...((query.fromDate || query.toDate) && {
        createdAt: {
          ...(query.fromDate && {
            gte: new Date(new Date(query.fromDate).setHours(0, 0, 0, 0)),
          }),
          ...(query.toDate && {
            lte: new Date(new Date(query.toDate).setHours(23, 59, 59, 999)),
          }),
        },
      }),
    };

    // PARALLEL EXECUTION FOR PERFORMANCE
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * ADMIN: Reverses a successful payment entry on the gateway AND local database
   */
  async refund(paymentId: number, amount: number) {
    try {
      // 1. Fetch targeted payment record safely outside tx to prepare gateway payload
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new NotFoundException(
          `Local payment record matching index ID ${paymentId} could not be resolved.`,
        );
      }

      if (payment.status === PaymentStatus.REFUNDED) {
        throw new BadRequestException(
          'This transaction has already been marked as REFUNDED.',
        );
      }

      if (payment.status !== PaymentStatus.SUCCESS || !payment.transactionId) {
        throw new BadRequestException(
          `Only successful payments can be refunded.`,
        );
      }

      if (amount <= 0 || amount > payment.amount) {
        throw new BadRequestException(
          `Invalid partial refund amount. Must be greater than 0 and less than or equal to ${payment.amount}.`,
        );
      }

      // 2. RUN THE REAL GATEWAY REFUND FIRST
      const gatewayResponse = await this.seylanMpgsService.executeRefund(
        payment.transactionId,
        amount,
      );

      if (gatewayResponse.result !== 'SUCCESS') {
        throw new BadRequestException(
          'The payment gateway declined to process this refund request.',
        );
      }

      // 3. COMMIT TO LOCAL DATABASE ONCE GATEWAY APPROVES
      return await this.prisma.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: PaymentStatus.REFUNDED,
            refundedAmount: amount,
            gatewayData: {
              ...(payment.gatewayData as Record<string, any>),
              refundLog: gatewayResponse,
            },
          },
        });

        const parentBooking = await tx.booking.findUnique({
          where: { id: payment.bookingId },
          include: { payments: true },
        });

        if (parentBooking) {
          const liveCapturedFunds = parentBooking.payments
            .filter((p) => p.status === PaymentStatus.SUCCESS)
            .reduce((sum, p) => sum + p.amount, 0);

          let rollbackStatus: BookingStatus = parentBooking.status;

          if (liveCapturedFunds === 0) {
            rollbackStatus = BookingStatus.CANCELLED;
          } else if (liveCapturedFunds < parentBooking.totalAmount) {
            rollbackStatus = BookingStatus.ACTIVE;
          }

          if (rollbackStatus !== parentBooking.status) {
            await tx.booking.update({
              where: { id: parentBooking.id },
              data: { status: rollbackStatus },
            });
          }
        }

        return {
          status: 'success',
          message: 'Real financial refund executed and captured successfully.',
          data: updatedPayment,
        };
      });
    } catch (error) {
      this.handleError(
        `reversing payment database ledger allocation index ID ${paymentId}`,
        error,
      );
    }
  }

  /**
   * Verify Webhook Secret
   */
  private verifyWebhookSecret(receivedSecret: string | undefined): void {
    const expectedSecret = this.configService.get<string>(
      'SEYLAN_WEBHOOK_SECRET',
    );

    if (!expectedSecret) {
      // fail closed if misconfigured — don't silently accept everything
      this.logger.error('SEYLAN_WEBHOOK_SECRET is not configured');
      throw new UnauthorizedException('Webhook verification not configured');
    }

    if (!receivedSecret) {
      throw new UnauthorizedException('Missing notification secret');
    }

    const expectedBuf = Buffer.from(expectedSecret);
    const receivedBuf = Buffer.from(receivedSecret);

    // timingSafeEqual throws if lengths differ, so check that first
    if (
      expectedBuf.length !== receivedBuf.length ||
      !timingSafeEqual(expectedBuf, receivedBuf)
    ) {
      throw new UnauthorizedException('Invalid notification secret');
    }
  }

  /**
   * Internal helper layer to safely sync overall reservation metrics following mutations
   */
  private async syncBookingStatus(
    tx: Prisma.TransactionClient,
    bookingId: number,
  ) {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { payments: true },
    });

    if (!booking) return;

    const liveCapturedFunds = booking.payments
      .filter((p) => p.status === PaymentStatus.SUCCESS)
      .reduce((sum, p) => sum + p.amount, 0);

    let nextStatus: BookingStatus = booking.status;

    if (liveCapturedFunds === 0) {
      // If no valid items remain active following adjustments, mark down appropriately
      const hasRefunds = booking.payments.some(
        (p) => p.status === PaymentStatus.REFUNDED,
      );
      nextStatus = hasRefunds ? BookingStatus.CANCELLED : booking.status;
    } else if (liveCapturedFunds < booking.totalAmount) {
      nextStatus = BookingStatus.ACTIVE;
    } else if (liveCapturedFunds >= booking.totalAmount) {
      nextStatus = BookingStatus.CONFIRMED;
    }

    if (nextStatus !== booking.status) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: nextStatus },
      });
    }
  }

  /**
   * Internal Error Handler for Logging and Standardized Response
   */
  private handleError(action: string, error: any) {
    this.logger.error(`Error ${action}: ${error.message}`, error.stack);
    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException
    )
      throw error;
    throw new InternalServerErrorException(
      `Failed to process review request during ${action}.`,
    );
  }
}
