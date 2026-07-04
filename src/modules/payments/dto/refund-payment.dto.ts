import { IsNotEmpty, IsNumber, IsPositive } from 'class-validator';

export class RefundPaymentDto {
  @IsNotEmpty({ message: 'Refund amount is required' })
  @IsNumber(
    {},
    { message: 'Refund amount must be a clean numeric layout value' },
  )
  @IsPositive()
  amount: number;
}
