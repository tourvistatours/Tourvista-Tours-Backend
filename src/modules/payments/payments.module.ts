import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { MailModule } from '../../infrastructure/mail/mail.module';
import { SeylanMpgsModule } from '../../infrastructure/seylan/seylan-mpgs.module';

@Module({
  imports: [SeylanMpgsModule, MailModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
