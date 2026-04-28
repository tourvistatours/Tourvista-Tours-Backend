import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { BookingStatus } from '../../../common/enums/booking-status.enum';

export class FilterBookingDto {
  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  @IsNumberString()
  limit?: number;

  // ADMIN FILTERS
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;
}
