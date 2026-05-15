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

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private prisma: PrismaService) {}

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

  async create(userId: string, data: CreatePaymentDto) {
    // VALIDATE OWNERSHIP AND EXISTENCE
    const booking = await this.prisma.booking.findUnique({
      where: { id: data.bookingId },
    });

    if (!booking || booking.userId !== userId) {
      throw new NotFoundException(
        'The requested booking was not found or access is restricted',
      );
    }

    // TODO: PAYMENT GATEWAY

    // TRANSACTION: CREATE PAYMENT AND UPDATE BOOKING STATUS
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: {
            ...data,
            userId,

            // MOCK STATUS
            status: PaymentStatus.SUCCESS, // IN PRODUCTION: PAYMENT GATEWAY NEEDED
          },
        });

        await tx.booking.update({
          where: { id: data.bookingId },
          data: {
            status:
              data.type === PaymentType.FULL
                ? BookingStatus.CONFIRMED
                : BookingStatus.ACTIVE,
          },
        });

        return true;
      });
    } catch (error) {
      this.logger.error(
        `FAILED_TO_CREATE_PAYMENT: BookingID ${data.bookingId} | ${error}`,
      );
      throw new BadRequestException(
        'Transaction failed: Unable to synchronize payment with booking status',
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
