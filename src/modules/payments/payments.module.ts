import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { PayhereModule } from '../../infrastructure/payhere/payhere.module';

@Module({
  imports: [PayhereModule, MailModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
