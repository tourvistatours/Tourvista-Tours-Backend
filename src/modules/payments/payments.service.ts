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
import { PayhereService } from '../../infrastructure/payhere/payhere.service';
// import { MailService } from '../../infrastructure/mail/mail.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private payhereService: PayhereService,
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

    // Generate a distinct order Tracking String for this specific attempt instance
    const orderId = `TV-${booking.id}-${Date.now()}`;

    const basePayload = await this.payhereService.generatePaymentPayload(
      orderId,
      data.amount,
      {
        firstName: booking.user.firstName,
        lastName: booking.user.lastName,
        email: booking.user.email,
      },
    );

    // Create a tracking record stub for this specific attempt session instance
    await this.prisma.payment.create({
      data: {
        bookingId: data.bookingId,
        userId: userId,
        amount: data.amount,
        type: data.type, // FULL or ADVANCE
        status: PaymentStatus.PENDING,
        transactionId: orderId, // Pass our orderId tracking string here initially
      },
    });

    return {
      ...basePayload,
      custom_1: userId,
      custom_2: data.bookingId.toString(),
      custom_3: orderId, // 💡 Pass the unique tracking string orderId here so the webhook can find this exact row!
    };
  }

  /**
   * STEP 2: Securely capture payment feedback webhooks without causing unique constraint drops
   */
  async processWebhook(payload: any) {
    this.payhereService.verifyWebhookSignature(payload);

    const bookingId = parseInt(payload.custom_2, 10);
    const internalOrderId = payload.custom_3; // The unique TV-... tracking string string we generated
    const payhereGatewayId = payload.payment_id; // PayHere's unique network reference sequence string
    const statusCode = payload.status_code;

    let targetStatus: PaymentStatus = PaymentStatus.FAILED;
    if (statusCode === '2') targetStatus = PaymentStatus.SUCCESS;
    if (statusCode === '0') targetStatus = PaymentStatus.PENDING;
    if (statusCode === '-1' || statusCode === '-2')
      targetStatus = PaymentStatus.CANCELLED;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // 1. Find and update the exact payment attempt session row
        const currentPayment = await tx.payment.findFirst({
          where: { transactionId: internalOrderId },
        });

        if (!currentPayment) {
          throw new NotFoundException(
            'Payment sequence record context tracking lost.',
          );
        }

        const updatedPayment = await tx.payment.update({
          where: { id: currentPayment.id },
          data: {
            status: targetStatus,
            transactionId: payhereGatewayId, // Overwrite with official PayHere network index string reference
            gatewayData: payload as any,
          },
        });

        // 2. Compute dynamic financial balance checks if the payment was a success
        if (targetStatus === PaymentStatus.SUCCESS) {
          // Fetch all successful historical entries linked to this booking
          const allConfirmedPayments = await tx.payment.findMany({
            where: { bookingId: bookingId, status: PaymentStatus.SUCCESS },
          });

          const targetBooking = await tx.booking.findUnique({
            where: { id: bookingId },
          });

          const totalAccumulatedFunds = allConfirmedPayments.reduce(
            (sum, p) => sum + p.amount,
            0,
          );

          // Determine if booking state metrics are finalized
          const isFullyPaid =
            totalAccumulatedFunds >= (targetBooking?.totalAmount || 0);

          await tx.booking.update({
            where: { id: bookingId },
            data: {
              status: isFullyPaid
                ? BookingStatus.CONFIRMED
                : BookingStatus.ACTIVE,
            },
          });

          this.logger.log(
            `Booking ID ${bookingId} balance updated. Total paid: $${totalAccumulatedFunds}`,
          );
        }

        return { status: 'acknowledged' };
      });
    } catch (error) {
      this.logger.error(
        `Webhook runtime matching fail tracking: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadRequestException(
        'Data layer sequence adjustment failure execution error.',
      );
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
