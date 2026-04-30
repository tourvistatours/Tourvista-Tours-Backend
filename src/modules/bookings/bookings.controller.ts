import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Delete,
  Patch,
} from '@nestjs/common';

import { BookingsService } from './bookings.service';

import { CreateBookingDto } from './dto/create-booking.dto';
import { QueryAdminBookingDto } from './dto/query-admin-booking.dto';
import { QueryUserBookingDto } from './dto/query-user-booking.dto';
import { UpdateBookingAdminDto } from './dto/update-booking-admin.dto';
import { UpdateBookingUserDto } from './dto/update-booking-user.dto';

import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../auth/enums/role.enum';
import { GetUser } from '../../auth/decorators/get-user.decorator';

@Controller('v1/bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles(Role.USER)
  create(@GetUser('id') userId: string, @Body() body: CreateBookingDto) {
    return this.bookingsService.create(userId, body);
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  findAdminAll(@Query() query: QueryAdminBookingDto) {
    return this.bookingsService.findAdminAll(query);
  }

  @Get('user')
  @Roles(Role.USER)
  findUserAll(
    @GetUser('id') userId: string,
    @Query() query: QueryUserBookingDto,
  ) {
    return this.bookingsService.findUserAll(userId, query);
  }

  @Patch(':id/admin')
  @Roles(Role.ADMIN)
  updateByAdmin(@Param('id') id: string, @Body() body: UpdateBookingAdminDto) {
    return this.bookingsService.updateByAdmin(+id, body);
  }

  @Patch(':id/user')
  @Roles(Role.USER)
  updateByUser(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Body() body: UpdateBookingUserDto,
  ) {
    return this.bookingsService.updateByUser(+id, userId, body);
  }

  @Delete(':id')
  remove(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.bookingsService.remove(+id, userId);
  }
}
