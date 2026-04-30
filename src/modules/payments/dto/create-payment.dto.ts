import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, Min } from 'class-validator';
import { PaymentType } from '../../../common/enums/payment-type.enum';

export class CreatePaymentDto {
  @Type(() => Number)
  @IsNotEmpty({ message: 'Booking ID is required' })
  bookingId: number;

  @Type(() => Number)
  @IsNotEmpty({ message: 'Amount is required' })
  @Min(10, { message: 'Minimum amount is 10' })
  amount: number;

  @IsEnum(PaymentType)
  @IsNotEmpty({ message: 'Payment Type is required' })
  type: PaymentType;
}
