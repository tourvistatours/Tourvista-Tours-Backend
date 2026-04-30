import { IsNumberString, IsOptional } from 'class-validator';

export class QueryUserBookingDto {
  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  @IsNumberString()
  limit?: number;
}
