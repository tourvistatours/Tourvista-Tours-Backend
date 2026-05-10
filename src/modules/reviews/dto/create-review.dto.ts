import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @Type(() => Number)
  @Min(1, { message: 'Rating must be at least 1' })
  @Max(5, { message: 'Rating must be at most 5' })
  rating: number;

  @IsString()
  @IsNotEmpty({ message: 'Comment is required' })
  comment: string;

  @Type(() => Number)
  @IsNotEmpty({ message: 'Tour ID is required' })
  tourId: number;
}
