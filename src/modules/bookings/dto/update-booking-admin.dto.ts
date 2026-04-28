import { IsEnum, IsOptional } from 'class-validator';
import { BookingStatus } from '../../../common/enums/booking-status.enum';

export class UpdateBookingAdminDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}
