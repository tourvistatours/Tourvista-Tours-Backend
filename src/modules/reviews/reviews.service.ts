import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Prisma } from '@prisma/client';
import { Role } from '../../auth/enums/role.enum';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * ADMIN: Returns total number of reviews.
   * Used for analytics.
   */
  async getStats() {
    try {
      // GET THE GRAND TOTAL
      const totalCount = await this.prisma.review.count();

      return { total: totalCount };
    } catch (error) {
      this.handleError('fetching review stats', error);
    }
  }

  /**
   * PUBLIC: Fetches top 10 featured reviews.
   * Prioritizes 'isFeatured' flag and high ratings for marketing sections.
   */
  async getFeatured() {
    try {
      return await this.prisma.review.findMany({
        where: { isVisible: true, isFeatured: true },
        take: 10,
        orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
        select: {
          rating: true,
          comment: true,
          user: { select: { firstName: true, lastName: true, email: true } },
          tour: { select: { title: true } },
        },
      });
    } catch (error) {
      this.handleError('fetching featured reviews', error);
    }
  }

  /**
   * USER: Adds a new review.
   * Default visibility is 'true', featured is 'false'.
   */
  async create(userId: string, dto: CreateReviewDto) {
    try {
      const review = await this.prisma.review.create({
        data: { ...dto, userId },
      });
      return { reviewId: review.id, message: 'Review submitted successfully.' };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('You have already reviewed this tour.');
      }
      this.handleError('creating review', error);
    }
  }

  /**
   * PUBLIC/ADMIN: Get reviews with dynamic filtering.
   * Public users only see 'isVisible: true'. Admins see everything.
   */
  async findAll(query: QueryReviewDto, role: Role) {
    const { page = 1, limit = 10, search, isFeatured, isVisible } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {
      ...(role === Role.ADMIN
        ? isVisible !== undefined
          ? { isVisible }
          : {}
        : { isVisible: true }),

      ...(isFeatured !== undefined && { isFeatured }),

      ...(search && {
        OR: [
          { tourId: Number(search) },
          { rating: Number(search) },
          { comment: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { user: { firstName: { contains: search, mode: 'insensitive' } } },
          { user: { lastName: { contains: search, mode: 'insensitive' } } },
          { tour: { title: { contains: search, mode: 'insensitive' } } },
        ],
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

    try {
      const [data, total] = await Promise.all([
        this.prisma.review.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
            tour: { select: { title: true } },
          },
        }),
        this.prisma.review.count({ where }),
      ]);

      return {
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    } catch (error) {
      this.handleError('fetching reviews', error);
    }
  }

  /**
   * USER/ADMIN: Updates review content.
   */
  async update(id: string, dto: UpdateReviewDto) {
    try {
      const review = await this.prisma.review.findUnique({ where: { id } });
      if (!review) throw new NotFoundException('Review not found.');

      const updated = await this.prisma.review.update({
        where: { id },
        data: dto,
      });

      return { reviewId: updated.id, message: 'Review updated successfully.' };
    } catch (error) {
      this.handleError('updating review content', error);
    }
  }

  /**
   * ADMIN: Specialized update for moderation flags.
   */
  async updateAdminFields(
    id: string,
    data: { isVisible?: boolean; isFeatured?: boolean },
  ) {
    try {
      const updated = await this.prisma.review.update({
        where: { id },
        data,
      });
      return {
        reviewId: updated.id,
        message: 'Review status updated by admin.',
      };
    } catch (error) {
      this.handleError('updating admin fields', error);
    }
  }

  /**
   * ADMIN: Permanent deletion of a review.
   */
  async remove(id: string) {
    try {
      await this.prisma.review.delete({ where: { id } });
      return { message: 'Review deleted successfully.' };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Review not found.');
      }
      this.handleError('deleting review', error);
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
