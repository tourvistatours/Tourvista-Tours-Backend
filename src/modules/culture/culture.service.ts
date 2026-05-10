import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UploadApiResponse } from 'cloudinary';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CloudinaryService } from '../../infrastructure/cloudinary/cloudinary.service';

import { CreateCultureDto } from './dto/create-culture.dto';
import { UpdateCultureDto } from './dto/update-culture.dto';
import { CultureQueryDto } from './dto/query-culture.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class CultureService {
  private readonly logger = new Logger(CultureService.name);
  private readonly FOLDER_NAME = 'culture';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // -------------------------------------------------------------------------
  // CULTURE CATEGORY LOGIC
  // -------------------------------------------------------------------------

  /**
   * PERSISTS A NEW CULTURE CATEGORY TO THE DATABASE
   * @body DTO - VALIDATED DATA FOR THE NEW CULTURE CATEGORY.
   * @returns THE NEWLY CREATED CULTURE RECORD
   */
  async create(dto: CreateCultureDto) {
    try {
      return await this.prisma.culture.create({
        data: dto,
      });
    } catch (error) {
      this.logger.error(
        `Failed to create culture: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'An unexpected error occurred while creating the culture category.',
      );
    }
  }

  /**
   * Retrieves a paginated list of cultures with optional keyword filtering.
   * @param query - Includes search term, page number, and record limit.
   * @returns An object containing a list of cultures and pagination metadata.
   */
  async findAll(query: CultureQueryDto) {
    const { search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    // Build the search filter conditionally
    const where: Prisma.CultureWhereInput = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    try {
      const [total, data] = await Promise.all([
        this.prisma.culture.count({ where }),
        this.prisma.culture.findMany({
          where,
          skip,
          take: limit,
          include: {
            _count: {
              select: { cultureItems: true },
            },
          },
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
      this.logger.error(
        `Search operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'An unexpected error occurred while searching for culture categories.',
      );
    }
  }

  /**
   * Updates an existing culture by ID.
   * @param id - The ID of the culture to update.
   * @body dto - Validated data for the updated culture.
   * @returns The updated culture record.
   */
  async update(id: string, dto: UpdateCultureDto) {
    try {
      return await this.prisma.culture.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      this.logger.error(
        `Update operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'An unexpected error occurred while updating the culture category.',
      );
    }
  }

  /**
   * Removes an culture category and all its children
   * @param id - The ID of the culture category to remove.
   * @returns A success message.
   */
  async remove(id: string) {
    try {
      const exists = await this.prisma.culture.findUnique({ where: { id } });
      if (!exists) throw new NotFoundException('Culture category not found');

      // 1. Delete from Cloudinary
      await this.cloudinary.deleteFolderRecursive(`${this.FOLDER_NAME}/${id}`);

      // 2. Delete from DB
      await this.prisma.culture.delete({
        where: { id },
      });

      return {
        message: `Culture category "${id}" has been successfully deleted.`,
      };
    } catch (error) {
      this.logger.error(
        `Delete operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'An unexpected error occurred while deleting the culture category.',
      );
    }
  }

  // -------------------------------------------------------------------------
  // CULTURE ITEMS (PLACES) LOGIC
  // -------------------------------------------------------------------------

  /**
   * Adds a new item/place to a category with an image upload.
   * @param cultureId - The ID of the parent culture category.
   * @body dto - Validated data for the new item/place.
   * @file file - The image file to upload.
   * @returns The newly created item record.
   */
  async addItem(
    cultureId: string,
    dto: CreateItemDto,
    file: Express.Multer.File,
  ) {
    // 1. Verify the parent category exists
    const category = await this.prisma.culture.findUnique({
      where: { id: cultureId },
    });
    if (!category) throw new NotFoundException('Culture category not found');

    let uploadResult: UploadApiResponse | null = null;
    try {
      // 2. Upload image to Cloudinary
      uploadResult = await this.cloudinary.uploadImage(
        file,
        `${this.FOLDER_NAME}/${cultureId}`,
        undefined,
      );

      // 3. Save to database
      return await this.prisma.cultureItem.create({
        data: {
          title: dto.title,
          description: dto.description,
          mainImageUrl: uploadResult.secure_url,
          cultureId: cultureId,
        },
      });
    } catch (error) {
      // Cleanup: If DB fails but image uploaded, delete image from Cloudinary
      if (uploadResult) {
        await this.cloudinary.deleteImage(uploadResult.public_id);
      }
      this.logger.error(
        `Failed to add item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'An unexpected error occurred while adding the item.',
      );
    }
  }

  /**
   * Fetches all items for a specific category.
   * @param cultureId - The ID of the parent culture category.
   * @returns An array of item records.
   */
  async findAllItems(cultureId: string) {
    const items = await this.prisma.cultureItem.findMany({
      where: { cultureId },
      orderBy: { createdAt: 'desc' },
    });

    return items || [];
  }

  /**
   * Updates an item's details and optionally its image.
   * @param itemId - The ID of the item to update.
   * @body dto - Validated data for the updated item.
   * @file file - The image file to upload (optional).
   * @returns The updated item record.
   */
  async updateItem(
    itemId: string,
    dto: UpdateItemDto,
    file?: Express.Multer.File,
  ) {
    const existingItem = await this.prisma.cultureItem.findUnique({
      where: { id: itemId },
    });
    if (!existingItem) throw new NotFoundException('Item not found');

    let newImageUrl = existingItem.mainImageUrl;

    try {
      // 1. If a new file is provided, handle Cloudinary replacement
      if (file) {
        const oldPublicId = this.cloudinary.extractPublicId(
          existingItem.mainImageUrl,
        );
        const uploadResult = await this.cloudinary.uploadImage(
          file,
          `${this.FOLDER_NAME}/${existingItem.cultureId}`,
          oldPublicId, // Replace old image
        );
        newImageUrl = uploadResult.secure_url;
      }

      // 2. Update DB
      return await this.prisma.cultureItem.update({
        where: { id: itemId },
        data: {
          ...dto,
          mainImageUrl: newImageUrl,
        },
      });
    } catch (error) {
      this.logger.error(
        `Update item error: ${error instanceof Error ? error.message : 'Unknown'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'An unexpected error occurred while updating the item.',
      );
    }
  }

  /**
   * Deletes an item and its image from Cloudinary.
   * @param itemId - The ID of the item to delete.
   * @returns A success message.
   */
  async removeItem(itemId: string) {
    try {
      const item = await this.prisma.cultureItem.findUnique({
        where: { id: itemId },
      });
      if (!item) throw new NotFoundException('cultureItem not found');

      // 1. Delete from Cloudinary
      const publicId = this.cloudinary.extractPublicId(item.mainImageUrl);
      await this.cloudinary.deleteImage(publicId);

      await this.cloudinary.deleteFolderRecursive(
        `${this.FOLDER_NAME}/${item.cultureId}/${itemId}`,
      );

      // 2. Delete from DB
      await this.prisma.cultureItem.delete({ where: { id: itemId } });

      return { message: 'Culture item deleted successfully' };
    } catch (error) {
      this.logger.error(
        `Delete item error: ${error instanceof Error ? error.message : 'Unknown'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'An unexpected error occurred while deleting the item.',
      );
    }
  }

  // -------------------------------------------------------------------------
  // GALLERY LOGIC
  // -------------------------------------------------------------------------
  /**
   * Adds multiple images to an item's gallery.
   * @param itemId - The ID of the parent item.
   * @param files - The image files to upload.
   * @returns An array of gallery image URLs.
   */
  async addGalleryImages(itemId: string, files: Express.Multer.File[]) {
    // 1. Validate Item and Current Gallery Count
    const item = await this.prisma.cultureItem.findUnique({
      where: { id: itemId },
      include: { _count: { select: { gallery: true } } },
    });

    if (!item) throw new NotFoundException('Item not found');
    if (item._count.gallery + files.length > 20) {
      throw new ConflictException(
        'Gallery limit reached (Max 20 images total)',
      );
    }

    const uploadResults: { secure_url: string; public_id: string }[] = [];

    try {
      // 2. Upload all files to Cloudinary in parallel
      const uploadPromises = files.map((file) =>
        this.cloudinary.uploadImage(
          file,
          `${this.FOLDER_NAME}/${item.cultureId}/${itemId}`,
        ),
      );
      const results = await Promise.all(uploadPromises);

      results.forEach((res) =>
        uploadResults.push({
          secure_url: res.secure_url,
          public_id: res.public_id,
        }),
      );

      // 3. Save all references to DB in a single transaction
      return await this.prisma.cultureItemImage.createMany({
        data: uploadResults.map((res) => ({
          imageUrl: res.secure_url,
          publicId: res.public_id,
          cultureItemId: itemId,
        })),
      });
    } catch (error) {
      // ROLLBACK: Delete uploaded images from Cloudinary if DB fails
      if (uploadResults.length > 0) {
        await Promise.all(
          uploadResults.map((res) =>
            this.cloudinary.deleteImage(res.public_id),
          ),
        );
      }
      this.logger.error(
        `Gallery upload error: ${error instanceof Error ? error.message : 'Unknown'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'An unexpected error occurred while uploading gallery images.',
      );
    }
  }

  /**
   * Retrieves all gallery images for an item.
   * @param itemId - The ID of the parent item.
   * @returns An array of gallery image URLs.
   */
  async getGalleryImages(itemId: string) {
    return await this.prisma.cultureItemImage.findMany({
      where: { cultureItemId: itemId },
      select: { id: true, imageUrl: true },
    });
  }

  /**
   * Removes a single gallery image from both Cloudinary and Database.
   * @param imageId - The ID of the gallery image to remove.
   * @returns A success message.
   */
  async removeGalleryImage(imageId: string) {
    const image = await this.prisma.cultureItemImage.findUnique({
      where: { id: imageId },
    });

    if (!image) throw new NotFoundException('Gallery image not found');

    try {
      // 1. Delete from Cloudinary
      await this.cloudinary.deleteImage(image.publicId);

      // 2. Delete from DB
      await this.prisma.cultureItemImage.delete({
        where: { id: imageId },
      });

      return { message: 'Gallery image removed successfully' };
    } catch (error) {
      this.logger.error(
        `Delete gallery image error: ${error instanceof Error ? error.message : 'Unknown'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'An unexpected error occurred while deleting the gallery image.',
      );
    }
  }

  // -------------------------------------------------------------------------
  // PUBLIC / ALL-INCLUSIVE LOGIC
  // -------------------------------------------------------------------------

  /**
   * Retrieves all categories with a deep-mapped tree.
   * @param query - Includes search term, page number, and record limit.
   * @returns An array of categories with items and gallery images.
   */
  async findAllInclusive(query: CultureQueryDto) {
    const { search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CultureWhereInput = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    try {
      const [total, data] = await Promise.all([
        this.prisma.culture.count({ where }),
        this.prisma.culture.findMany({
          where,
          skip,
          take: limit,
          select: {
            title: true,
            description: true,
            cultureItems: {
              select: {
                title: true,
                description: true,
                mainImageUrl: true,
                gallery: {
                  select: {
                    imageUrl: true,
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
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
      this.logger.error(
        `Error fetching hydrated culture catalog: ${error instanceof Error ? error.message : 'Unknown'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'An unexpected error occurred while fetching the culture catalog.',
      );
    }
  }
}
