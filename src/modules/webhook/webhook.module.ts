import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { ClerkClientProvider } from '../../infrastructure/providers/clerk.provider';

@Module({
  providers: [WebhookService, ClerkClientProvider],
  controllers: [WebhookController],
})
export class WebhookModule {}
