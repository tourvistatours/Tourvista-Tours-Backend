import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { CreateBookingDto } from './dto/create-booking.dto';
import { FilterBookingDto } from './dto/filter-booking.dto';
import { UpdateBookingAdminDto } from './dto/update-booking-admin.dto';
import { UpdateBookingUserDto } from './dto/update-booking-user.dto';

import { UserRole } from '../../common/enums/role.enum';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: CreateBookingDto) {
    const booking = await this.prisma.booking.create({
      data: {
        ...data,
        userId: userId,
      },
      select: {
        id: true,
      },
    });

    return { bookingId: booking.id };
  }

  async findAll(userId: string, role: string, filters: FilterBookingDto) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    // FILTER BY USER ID
    if (role === UserRole.USER) {
      where.userId = userId;
    }

    // FILTER BY STATUS
    if (filters.status) {
      where.status = filters.status;
    }

    // DATE RANGE FILTER
    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};

      if (filters.fromDate) {
        const from = new Date(filters.fromDate);
        if (!isNaN(from.getTime())) {
          from.setHours(0, 0, 0, 0);
          where.createdAt.gte = from;
        }
      }

      if (filters.toDate) {
        const to = new Date(filters.toDate);
        if (!isNaN(to.getTime())) {
          to.setHours(23, 59, 59, 999);
          where.createdAt.lte = to;
        }
      }
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        ...(role === UserRole.ADMIN && {
          include: {
            user: true,
          },
        }),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
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

  async findOne(id: number) {
    return this.prisma.booking.findUnique({
      where: { id },
    });
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
    });

    if (!current || current.userId !== userId) {
      throw new Error('Booking not found or unauthorized');
    }

    let updateData: any = {
      ...data,
    };

    if (
      data.numberOfTravellers &&
      data.numberOfTravellers !== current.numberOfTravellers
    ) {
      const pricePerTraveller =
        current.totalAmount / current.numberOfTravellers;

      updateData.totalAmount = data.numberOfTravellers * pricePerTraveller;
    }

    return this.prisma.booking.updateMany({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: number, userId: string, role: string) {
    if (role === UserRole.ADMIN) {
      return this.prisma.booking.delete({
        where: { id },
      });
    }

    const current = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!current || current.userId !== userId) {
      throw new Error('Booking not found or unauthorized');
    }

    return this.prisma.booking.delete({
      where: { id },
    });
  }
}
