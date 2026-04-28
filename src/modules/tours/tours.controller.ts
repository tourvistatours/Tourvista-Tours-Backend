import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { ToursService } from './tours.service';
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { FilterTourDto } from './dto/filter-tour.dto';

import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';

@Controller('v1/tours')
export class ToursController {
  constructor(private readonly toursService: ToursService) {}

  @Get('stats')
  @Roles(Role.ADMIN)
  getStats() {
    return this.toursService.getStats();
  }

  @Post()
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  create(
    @Body() body: CreateTourDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.toursService.create(body, file);
  }

  @Public()
  @Get()
  findAll(@Query() query: FilterTourDto) {
    return this.toursService.findAll(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.toursService.findOne(+id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  update(
    @Param('id') id: string,
    @Body() body: UpdateTourDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.toursService.update(+id, body, file);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.toursService.remove(+id);
  }
}
