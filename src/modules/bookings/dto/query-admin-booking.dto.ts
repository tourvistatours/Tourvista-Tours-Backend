import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { BookingStatus } from '../../../common/enums/booking-status.enum';

export class QueryAdminBookingDto {
  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  @IsNumberString()
  limit?: number;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: string;

  @IsOptional()
  @IsNumberString()
  minTotalAmount?: number;

  @IsOptional()
  @IsNumberString()
  maxTotalAmount?: number;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;
}
