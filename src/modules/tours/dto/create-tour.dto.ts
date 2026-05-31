import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  Min,
  MinLength,
  MaxLength,
  Max,
} from 'class-validator';

export class CreateTourDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MinLength(3, { message: 'Title must be at least 3 characters' })
  @MaxLength(100, { message: 'Title must be at most 100 characters' })
  title!: string;

  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  @MinLength(10, { message: 'Description must be at least 10 characters' })
  @MaxLength(2000, { message: 'Description must be at most 2000 characters' })
  description!: string;

  @IsString()
  @IsNotEmpty({ message: 'Location is required' })
  @MinLength(3, { message: 'Location must be at least 3 characters' })
  @MaxLength(100, { message: 'Location must be at most 100 characters' })
  location!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Price must not be negative' })
  price!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Duration must not be negative' })
  duration!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Minimum guests must be at least 1' })
  minGuests!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Maximum guests must be at least 1' })
  @Max(100, { message: 'Maximum guests cannot exceed 100' })
  maxGuests!: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}
