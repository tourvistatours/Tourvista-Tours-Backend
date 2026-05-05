import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UploadedFile,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiOperation } from '@nestjs/swagger';

import { CultureService } from './culture.service';
import { CreateCultureDto } from './dto/create-culture.dto';
import { UpdateCultureDto } from './dto/update-culture.dto';
import { CultureQueryDto } from './dto/query-culture.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { FileValidatorUtil } from '../../common/utils/file-validator.util';
import { Role } from '../../auth/enums/role.enum';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('v1/culture')
export class CultureController {
  constructor(private readonly cultureService: CultureService) {}

  // -------------------------------------------------------------------------
  // CATEGORY OPERATIONS
  // -------------------------------------------------------------------------

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new culture category' })
  create(@Body() dto: CreateCultureDto) {
    return this.cultureService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all categories with pagination' })
  findAll(@Query() query: CultureQueryDto) {
    return this.cultureService.findAll(query);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update category details' })
  update(@Param('id') id: string, @Body() dto: UpdateCultureDto) {
    return this.cultureService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete category and nested items' })
  remove(@Param('id') id: string) {
    return this.cultureService.remove(id);
  }

  // -------------------------------------------------------------------------
  // ITEM (PLACE) OPERATIONS
  // -------------------------------------------------------------------------

  @Post(':id/items')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Add a place to a category' })
  addItem(
    @Param('id') id: string,
    @Body() dto: CreateItemDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    FileValidatorUtil.validate(file);
    return this.cultureService.addItem(id, dto, file);
  }

  @Get(':id/items')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all places in a category' })
  findAllItems(@Param('id') id: string) {
    return this.cultureService.findAllItems(id);
  }

  @Patch('items/:itemId')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Update place details and image' })
  updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      FileValidatorUtil.validate(file);
    }

    return this.cultureService.updateItem(itemId, dto, file);
  }

  @Delete('items/:itemId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a specific place' })
  removeItem(@Param('itemId') itemId: string) {
    return this.cultureService.removeItem(itemId);
  }

  // -------------------------------------------------------------------------
  // GALLERY OPERATIONS
  // -------------------------------------------------------------------------

  @Post('items/:itemId/gallery')
  @Roles(Role.ADMIN)
  @UseInterceptors(FilesInterceptor('images', 10)) // Limit to 10 Files
  @ApiOperation({ summary: 'Bulk upload images to an item gallery (Max 10)' })
  uploadGallery(
    @Param('itemId') itemId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    FileValidatorUtil.validateMany(files);
    return this.cultureService.addGalleryImages(itemId, files);
  }

  @Get('items/:itemId/gallery')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all gallery images for an item' })
  getGallery(@Param('itemId') itemId: string) {
    return this.cultureService.getGalleryImages(itemId);
  }

  @Delete('gallery/:imageId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Remove a specific image from gallery' })
  removeGalleryImage(@Param('imageId') imageId: string) {
    return this.cultureService.removeGalleryImage(imageId);
  }

  // -------------------------------------------------------------------------
  // PUBLIC / ALL-INCLUSIVE OPERATIONS
  // -------------------------------------------------------------------------

  @Get('all-inclusive')
  @Public()
  @ApiOperation({
    summary: 'Get all categories with their items and galleries (Paginated)',
  })
  findAllHydrated(@Query() query: CultureQueryDto) {
    return this.cultureService.findAllInclusive(query);
  }
}
