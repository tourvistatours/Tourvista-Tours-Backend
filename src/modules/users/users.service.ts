import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UserQueryDto } from './dto/query-user.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * ADMIN: Returns total number of users.
   * Used for analytics.
   */
  async getStats() {
    try {
      // GET THE GRAND TOTAL
      const totalCount = await this.prisma.user.count();

      return { total: totalCount };
    } catch (error) {
      this.handleError('fetching user stats', error);
    }
  }

  /**
   * ADMIN: Get users with dynamic filtering.
   * Admins see everything.
   */
  async findAll(query: UserQueryDto) {
    const { page = 1, limit = 10, search, role, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    // 1. Initialize the date filter object
    const dateFilter: Prisma.DateTimeFilter = {};

    if (fromDate) {
      dateFilter.gte = new Date(new Date(fromDate).setHours(0, 0, 0, 0));
    }

    if (toDate) {
      dateFilter.lte = new Date(new Date(toDate).setHours(23, 59, 59, 999));
    }

    // 2. Build the where clause
    const where: Prisma.UserWhereInput = {
      ...(role && { role }),
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    };

    try {
      const [total, data] = await Promise.all([
        this.prisma.user.count({ where }),
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
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
    } catch (error) {
      this.handleError('fetching users', error);
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
