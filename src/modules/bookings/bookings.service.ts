import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryAdminBookingDto } from './dto/query-admin-booking.dto';
import { QueryUserBookingDto } from './dto/query-user-booking.dto';
import { UpdateBookingAdminDto } from './dto/update-booking-admin.dto';
import { UpdateBookingUserDto } from './dto/update-booking-user.dto';

import { BookingStatus } from '../../common/enums/booking-status.enum';
import { addDays } from 'date-fns';
import { Role } from '../../auth/enums/role.enum';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * HELPER: CHECKS IF A TOUR IS AVAILABLE FOR A SPECIFIC DATE RANGE
   * @throws CONFLICTEXCEPTION IF DATES OVERLAP
   */
  // private async validateAvailability(
  //   tourId: number,
  //   start: Date,
  //   end: Date,
  //   excludeId?: number,
  // ) {
  //   const overlap = await this.prisma.booking.findFirst({
  //     where: {
  //       tourId,
  //       id: excludeId ? { not: excludeId } : undefined,
  //       AND: [
  //         { arrivalDate: { lt: addDays(end, 1) } },
  //         { checkoutDate: { gt: addDays(start, -1) } },
  //       ],
  //     },
  //   });

  //   if (overlap) {
  //     throw new ConflictException(
  //       `Tour dates ${start.toLocaleDateString()} - ${end.toLocaleDateString()} are already reserved.`,
  //     );
  //   }
  // }

  async create(userId: string, data: CreateBookingDto) {
    // VERIFY TOUR EXISTENCE AND ACTIVE STATUS
    const tour = await this.prisma.tour.findUnique({
      where: { id: data.tourId },
      select: { duration: true, isActive: true },
    });

    if (!tour)
      throw new NotFoundException('The requested tour package does not exist');
    if (!tour.isActive)
      throw new BadRequestException(
        'This tour is currently not accepting new reservations',
      );

    // CALCULATE DATE RANGE
    const start = new Date(data.arrivalDate);
    const end = addDays(start, tour.duration - 1);

    // await this.validateAvailability(data.tourId, start, end);

    // CREATE BOOKING
    const booking = await this.prisma.booking.create({
      data: {
        ...data,
        userId,
        checkoutDate: end,
      },
      select: {
        id: true,
      },
    });

    return { bookingId: booking.id };
  }

  async getStats() {
    // GET COUNTS GROUPED BY STATUS
    const statusCounts = await this.prisma.booking.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    // GET THE GRAND TOTAL
    const totalCount = await this.prisma.booking.count();

    // FORMATTING RESPONSE INTO A CLEAN OBJECT
    const stats = statusCounts.reduce(
      (acc, curr) => {
        acc[curr.status] = curr._count.id;
        return acc;
      },
      { total: totalCount } as Record<string, number>,
    );

    return stats;
  }

  async findAdminAll(query: QueryAdminBookingDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 12;

    const skip = (page - 1) * limit;

    // BUILD DYNAMIC FILTER OBJECT
    const where: any = {
      ...(query.status && { status: query.status }),
      ...((query.minTotalAmount || query.maxTotalAmount) && {
        totalAmount: {
          ...(query.minTotalAmount && { gte: Number(query.minTotalAmount) }),
          ...(query.maxTotalAmount && { lte: Number(query.maxTotalAmount) }),
        },
      }),
      ...((query.fromDate || query.toDate) && {
        arrivalDate: {
          ...(query.fromDate && {
            gte: new Date(new Date(query.fromDate).setHours(0, 0, 0, 0)),
          }),
          ...(query.toDate && {
            lte: new Date(new Date(query.toDate).setHours(23, 59, 59, 999)),
          }),
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        include: {
          tour: {
            select: {
              title: true,
            },
          },
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.count({ where }),
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

  async findUserAll(userId: string, query: QueryUserBookingDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 12;

    const skip = (page - 1) * limit;

    // FETCH ONLY NECESSARY FIELDS AT DATABASE LEVEL
    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          payment: {
            select: {
              id: true,
              type: true,
              amount: true,
            },
          },
          tour: {
            select: {
              id: true,
              title: true,
              minGuests: true,
              maxGuests: true,
            },
          },
        },
      }),
      this.prisma.booking.count({ where: { userId } }),
    ]);

    const sanitizedData = data.map((booking) => {
      const { userId, ...rest } = booking;
      return rest;
    });

    return {
      data: sanitizedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateByAdmin(id: number, data: UpdateBookingAdminDto) {
    return this.prisma.booking.update({
      where: { id },
      data,
    });
  }

  async updateByUser(id: number, userId: string, data: UpdateBookingUserDto) {
    const current = await this.prisma.booking.findUnique({
      where: { id },
      include: { tour: { select: { duration: true } } },
    });

    if (!current || current.userId !== userId)
      throw new NotFoundException('Booking record not found');
    if (current.status !== BookingStatus.PENDING)
      throw new BadRequestException(
        `Modifications restricted for ${current.status} bookings`,
      );

    const updateData: any = { ...data };

    // RE-VALIDATE AVAILABILITY IF DATE CHANGES
    if (
      data.arrivalDate &&
      data.arrivalDate !== current.arrivalDate.toISOString()
    ) {
      const start = new Date(data.arrivalDate);
      const end = addDays(start, current.tour.duration - 1);

      // await this.validateAvailability(current.tourId, start, end, id);
      updateData.checkoutDate = end;
    }

    // RE-CALCULATE PRICING IF GUEST COUNT CHANGES
    if (
      data.numberOfTravellers &&
      data.numberOfTravellers !== current.numberOfTravellers
    ) {
      const pricePerHead = current.totalAmount / current.numberOfTravellers;
      updateData.totalAmount = data.numberOfTravellers * pricePerHead;
    }

    const booking = await this.prisma.booking.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
      },
    });

    return { bookingId: booking.id };
  }

  async remove(id: number, userId: string, role: Role) {
    const current = await this.prisma.booking.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!current) throw new NotFoundException('Booking not found');
    // 1. Permission Check
    if (role === Role.USER && current.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this record',
      );
    }

    // 2. Status Check
    if (current.status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        `Cannot delete a ${current.status} booking`,
      );
    }

    // 3. Payment Dependency Check
    if (current.payment) {
      throw new BadRequestException(
        'Cannot delete booking because it has associated payment records. Please cancel the booking instead.',
      );
    }

    // 4. Final Delete
    const booking = await this.prisma.booking.delete({
      where: { id },
    });

    return { bookingId: booking.id };
  }
}
