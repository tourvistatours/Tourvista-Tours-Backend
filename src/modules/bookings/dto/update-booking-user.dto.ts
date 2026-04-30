import { Type } from 'class-transformer';
import {
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
  @IsNotEmpty({ message: 'Number of guests is required' })
  @Min(1, { message: 'There must be at least 1 guest' })
  numberOfTravellers?: number;

  @IsString()
  @IsOptional()
  @MaxLength(200, { message: 'Notes must be at most 200 characters' })
  notes?: string;
}
