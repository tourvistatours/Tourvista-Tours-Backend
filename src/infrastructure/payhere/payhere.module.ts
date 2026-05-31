import { Module } from '@nestjs/common';
import { PayhereService } from './payhere.service';
import { PayhereProvider } from '../providers/payhere.provider';

@Module({
  providers: [PayhereProvider, PayhereService],
  exports: [PayhereService],
})
export class PayhereModule {}
