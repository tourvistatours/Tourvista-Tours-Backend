import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { PaymentType } from '../../../common/enums/payment-type.enum';
import { PaymentStatus } from '../../../common/enums/payment-status.enum';

export class QueryPaymentDto {
  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  @IsNumberString()
  limit?: number;

  @IsOptional()
  @IsNumberString()
  minAmount?: number;

  @IsOptional()
  @IsNumberString()
  maxAmount?: number;

  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;
}
