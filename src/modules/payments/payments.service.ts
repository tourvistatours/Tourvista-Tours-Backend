import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { PaymentType } from '../../common/enums/payment-type.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { SeylanMpgsService } from '../../infrastructure/seylan/seylan-mpgs.service';
// import { MailService } from '../../infrastructure/mail/mail.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private seylanMpgsService: SeylanMpgsService,
    // private mailService: MailService,
  ) {}

  /**
   * ADMIN: Returns total number of payments.
   * Used for analytics.
   */
  async getStats() {
    try {
      // GET THE GRAND TOTAL
      const totalCount = await this.prisma.user.count();

      return { total: totalCount };
    } catch (error) {
      this.handleError('fetching payment stats', error);
    }
  }

  // async create(userId: string, data: CreatePaymentDto) {
  //   // VALIDATE OWNERSHIP AND EXISTENCE
  //   const booking = await this.prisma.booking.findUnique({
  //     where: { id: data.bookingId },
  //   });

  //   if (!booking || booking.userId !== userId) {
  //     throw new NotFoundException(
  //       'The requested booking was not found or access is restricted',
  //     );
  //   }

  //   // TODO: PAYMENT GATEWAY

  //   // TRANSACTION: CREATE PAYMENT AND UPDATE BOOKING STATUS
  //   try {
  //     return await this.prisma.$transaction(async (tx) => {
  //       await tx.payment.create({
  //         data: {
  //           ...data,
  //           userId,

  //           // MOCK STATUS
  //           status: PaymentStatus.SUCCESS, // IN PRODUCTION: PAYMENT GATEWAY NEEDED
  //         },
  //       });

  //       await tx.booking.update({
  //         where: { id: data.bookingId },
  //         data: {
  //           status:
  //             data.type === PaymentType.FULL
  //               ? BookingStatus.CONFIRMED
  //               : BookingStatus.ACTIVE,
  //         },
  //       });

  //       return true;
  //     });
  //   } catch (error) {
  //     this.logger.error(
  //       `FAILED_TO_CREATE_PAYMENT: BookingID ${data.bookingId} | ${error}`,
  //     );
  //     throw new BadRequestException(
  //       'Transaction failed: Unable to synchronize payment with booking status',
  //     );
  //   }
  // }

  /**
   * Step 1: Create a secure record stub and calculate the gateway signature hash configuration
   */
  async initiatePaymentIntent(userId: string, data: CreatePaymentDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: { user: true, payments: true },
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
    const orderId = `TV-${String(booking.id).padStart(6, '0')}-${dateStr}`;

    const gatewaySession = await this.seylanMpgsService.initiateCheckoutSession(
      orderId,
      data.amount,
      'LKR',
    );

    // console.log(gatewaySession);

    // Create a tracking record stub for this specific attempt session instance
    // await this.prisma.payment.create({
    //   data: {
    //     bookingId: data.bookingId,
    //     userId: userId,
    //     amount: data.amount,
    //     type: data.type, // FULL or ADVANCE
    //     status: PaymentStatus.PENDING,
    //     transactionId: orderId, // Pass our orderId tracking string here initially
    //     gatewayData: {
    //       successIndicator: gatewaySession.successIndicator,
    //       sessionId: gatewaySession.session.id,
    //     } as any,
    //   },
    // });

    return {
      sessionId: gatewaySession.session.id,
      successIndicator: gatewaySession.successIndicator,
      orderId: orderId,
      amount: data.amount,
    };
  }

  /**
   * STEP 2: Securely capture payment feedback webhooks without causing unique constraint drops
   */
  async processWebhook(payload: any) {
    // 1. Verify response validity structure according to Seylan signature parameter metrics
    // If verifying via signature hashes is required, compute matching HMAC keys here.

    const internalOrderId = payload.order.id; // Retain mapping reference string
    const gatewayTransactionId = payload.transaction.id;
    const gatewayResult = payload.result; // "SUCCESS", "FAILURE", etc.

    let targetStatus: PaymentStatus = PaymentStatus.FAILED;
    if (gatewayResult === 'SUCCESS') targetStatus = PaymentStatus.SUCCESS;
    if (gatewayResult === 'PENDING') targetStatus = PaymentStatus.PENDING;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Query the specific tracking record stub we made during initial checkout generation
        const currentPayment = await tx.payment.findFirst({
          where: { transactionId: internalOrderId },
        });

        if (!currentPayment) {
          throw new NotFoundException(
            'Payment sequence tracking context lost.',
          );
        }

        await tx.payment.update({
          where: { id: currentPayment.id },
          data: {
            status: targetStatus,
            transactionId: gatewayTransactionId, // Commit actual bank network confirmation ID string
            gatewayData: payload as any,
          },
        });

        // Recalculate your historical ledger updates
        if (targetStatus === PaymentStatus.SUCCESS) {
          const allConfirmedPayments = await tx.payment.findMany({
            where: {
              bookingId: currentPayment.bookingId,
              status: PaymentStatus.SUCCESS,
            },
          });

          const targetBooking = await tx.booking.findUnique({
            where: { id: currentPayment.bookingId },
          });

          const totalAccumulatedFunds = allConfirmedPayments.reduce(
            (sum, p) => sum + p.amount,
            0,
          );
          const isFullyPaid =
            totalAccumulatedFunds >= (targetBooking?.totalAmount || 0);

          await tx.booking.update({
            where: { id: currentPayment.bookingId },
            data: {
              status: isFullyPaid
                ? BookingStatus.CONFIRMED
                : BookingStatus.ACTIVE,
            },
          });
        }

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

  async update(id: number, userId: string, paymentPayload: {}) {
    // FETCH RECORD WITH RELATION AND VALIDATE
    const current = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        booking: true,
      },
    });

    if (!current || current.userId !== userId) {
      throw new NotFoundException(
        'Payment record not found or you lack the necessary permissions',
      );
    }

    if (!current.booking) {
      throw new BadRequestException(
        'Payment reconciliation failed: No linked booking found',
      );
    }

    // TODO: PAYMENT GATEWAY

    // TRANSACTION: UPDATE PAYMENT AND UPDATE BOOKING STATUS
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id },
          data: {
            amount: current.booking.totalAmount,
            type: PaymentType.FULL,

            // MOCK STATUS
            status: PaymentStatus.SUCCESS, // IN PRODUCTION: PAYMENT GATEWAY NEEDED
          },
        });

        await tx.booking.update({
          where: { id: current.bookingId },
          data: {
            status: BookingStatus.CONFIRMED,
          },
        });
      });

      return true;
    } catch (error) {
      this.logger.error(`FAILED_TO_UPDATE_PAYMENT: PaymentID ${id} | ${error}`);
      throw new BadRequestException(
        'Reconciliation failed: The payment and booking status could not be updated',
      );
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
