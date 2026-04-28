import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

export class FilterContactDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'all') return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
