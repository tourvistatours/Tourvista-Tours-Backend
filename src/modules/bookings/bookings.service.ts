import {
  Injectable,
  NotFoundException,
  ConflictException,
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

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * HELPER: CHECKS IF A TOUR IS AVAILABLE FOR A SPECIFIC DATE RANGE
   * @throws CONFLICTEXCEPTION IF DATES OVERLAP
   */
  /**
   * HELPER: VALIDATE TOUR AVAILABILITY
   * CHECKS IF ANY BOOKINGS OVERLAP WITH THE REQUESTED RANGE
   */
  private async validateAvailability(
    tourId: number,
    start: Date,
    end: Date,
    excludeId?: number,
  ) {
    const overlap = await this.prisma.booking.findFirst({
      where: {
        tourId,
        id: excludeId ? { not: excludeId } : undefined,
        AND: [
          { arrivalDate: { lt: addDays(end, 1) } },
          { checkoutDate: { gt: addDays(start, -1) } },
        ],
      },
    });

    if (overlap) {
      throw new ConflictException(
        `Tour dates ${start.toLocaleDateString()} - ${end.toLocaleDateString()} are already reserved.`,
      );
    }
  }

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

    await this.validateAvailability(data.tourId, start, end);

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

    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
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

      await this.validateAvailability(current.tourId, start, end, id);
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

  async remove(id: number, userId: string) {
    const current = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!current) throw new NotFoundException('Booking not found');
    if (current.userId !== userId)
      throw new ForbiddenException(
        'You do not have permission to delete this record',
      );
    if (current.status !== BookingStatus.PENDING)
      throw new BadRequestException(
        `Cannot delete a ${current.status} booking`,
      );

    const booking = await this.prisma.booking.delete({
      where: { id },
    });

    return { bookingId: booking.id };
  }
}
