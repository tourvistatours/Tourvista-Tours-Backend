import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { FilterContactDto } from './dto/filter-contact.dto';
import { MailService } from '../../infrastructure/mail/mail.service';

@Injectable()
export class ContactService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async create(data: CreateContactDto) {
    const inquiry = await this.prisma.contact.create({ data });

    // SEND ADMIN NOTIFICATION
    const unreadCount = await this.prisma.contact.count({
      where: { isRead: false },
    });
    this.mailService.sendInquiryAlert(unreadCount);

    return inquiry;
  }

  async findAll(filters: FilterContactDto) {
    const page = Number(filters.page || 1);
    const limit = Number(filters.limit || 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    // SEARCH FILTER
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { subject: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // DATE RANGE FILTER
    if (filters?.fromDate || filters?.toDate) {
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

    // IS READ FILTER
    if (filters?.isRead !== undefined) {
      where.isRead = filters.isRead;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.contact.count({ where }),
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

  async updateIsRead(id: number, isRead: boolean) {
    return this.prisma.contact.update({
      where: { id },
      data: { isRead },
    });
  }

  async remove(id: number) {
    return this.prisma.contact.delete({ where: { id } });
  }
}
