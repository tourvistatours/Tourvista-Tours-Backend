import { Injectable, Logger } from '@nestjs/common';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { FilterTourDto } from './dto/filter-tour.dto';

@Injectable()
export class ToursService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async getStats() {
    const [total, active, inactive] = await Promise.all([
      this.prisma.tour.count(),
      this.prisma.tour.count({ where: { isActive: true } }),
      this.prisma.tour.count({ where: { isActive: false } }),
    ]);

    return {
      total,
      active,
      inactive,
    };
  }

  async create(data: CreateTourDto, file?: Express.Multer.File) {
    let imageUrl = data.image;

    if (file) {
      const uploadResult = await this.cloudinary.uploadImage(
        file,
        'tour-plans',
        undefined,
        { title: data.title, location: data.location },
      );
      imageUrl = uploadResult.secure_url;
    }

    return this.prisma.tour.create({
      data: {
        ...data,
        price: Number(data.price),
        duration: Number(data.duration),
        image: imageUrl,
      },
    });
  }

  async findAll(filters: FilterTourDto) {
    const page = Number(filters.page || 1);
    const limit = Number(filters.limit || 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    // SEARCH FILTER
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // PRICE RANGE FILTER
    if (filters.minPrice || filters.maxPrice) {
      where.price = {
        ...(filters.minPrice && { gte: Number(filters.minPrice) }),
        ...(filters.maxPrice && { lte: Number(filters.maxPrice) }),
      };
    }

    // ACTIVE FILTER
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.tour.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tour.count({ where }),
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
    return this.prisma.tour.findUnique({
      where: { id },
    });
  }

  async update(id: number, data: UpdateTourDto, file?: Express.Multer.File) {
    const updateData: any = { ...data };

    // HANDLE IMAGE UPDATE
    if (file) {
      const existingId = data.image
        ? this.cloudinary.extractPublicId(data.image)
        : undefined;

      const { secure_url } = await this.cloudinary.uploadImage(
        file,
        'tour-plans',
        existingId,
        { title: data.title, location: data.location },
      );

      updateData.image = secure_url;
    }
    // HANDLE IMAGE REMOVAL
    else if (data.image === null || data.image === '') {
      const current = await this.prisma.tour.findUnique({
        where: { id },
        select: { image: true },
      });

      if (current?.image) {
        const publicId = this.cloudinary.extractPublicId(current.image);
        await this.cloudinary
          .deleteImage(publicId)
          .catch((err) => Logger.error(err));
      }

      updateData.image = null;
    }

    return this.prisma.tour.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: number) {
    const tour = await this.prisma.tour.findUnique({ where: { id } });

    // DELETE IMAGE FROM CLOUDINARY IF EXISTS
    if (tour?.image) {
      this.cloudinary
        .deleteImage(this.cloudinary.extractPublicId(tour.image))
        .catch((error) => {
          Logger.error(
            `Failed to delete image for tour ID ${id} from Cloudinary: ${error}`,
          );
        });
    }

    return this.prisma.tour.delete({
      where: { id },
    });
  }
}
