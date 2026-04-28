import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  MaxLength,
  IsNotEmpty,
  Min,
} from 'class-validator';

export class UpdateBookingUserDto {
  @IsDateString({}, { message: 'Start date must be a valid ISO date string' })
  @IsNotEmpty({ message: 'Start date is required' })
  arrivalDate?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Number of guests must be a number' })
  @IsNotEmpty({ message: 'Number of guests is required' })
  @Min(1, { message: 'There must be at least 1 guest' })
  numberOfTravellers?: number;

  @IsString()
  @IsOptional()
  @MaxLength(200, { message: 'Notes must be at most 200 characters' })
  notes?: string;
}
