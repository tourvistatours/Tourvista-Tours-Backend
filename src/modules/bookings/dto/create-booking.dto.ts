import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsDateString,
  Min,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreateBookingDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Tour ID must be a number' })
  @IsNotEmpty({ message: 'Tour ID is required' })
  tourId!: number;

  @IsDateString({}, { message: 'Start date must be a valid ISO date string' })
  @IsNotEmpty({ message: 'Start date is required' })
  arrivalDate!: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Number of guests must be a number' })
  @IsNotEmpty({ message: 'Number of guests is required' })
  @Min(1, { message: 'There must be at least 1 guest' })
  numberOfTravellers!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'Total amount must be a number' })
  @IsNotEmpty({ message: 'Total amount is required' })
  @Min(0, { message: 'Total amount cannot be negative' })
  totalAmount!: number;

  @IsString()
  @IsOptional()
  @MaxLength(200, { message: 'Notes must be at most 200 characters' })
  notes?: string;
}
