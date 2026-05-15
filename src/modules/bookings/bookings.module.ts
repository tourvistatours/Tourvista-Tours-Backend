import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { MailModule } from '../../infrastructure/mail/mail.module';

@Module({
  imports: [MailModule],
  providers: [BookingsService],
  controllers: [BookingsController],
})
export class BookingsModule {}
