import {
  Controller,
  Post,
  Req,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';

import { Webhook } from 'svix';
import { ConfigService } from '@nestjs/config';

import type { Request } from 'express';

import { WebhookService } from './webhook.service';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('webhooks/clerk')
export class WebhookController {
  constructor(
    private configService: ConfigService,
    private webhookService: WebhookService,
  ) {}

  @Public()
  @Post()
  async handleWebhook(
    @Req() req: Request,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ) {
    const webhookSecret = this.configService.get<string>(
      'CLERK_WEBHOOK_SECRET',
    );

    if (!webhookSecret) {
      throw new UnauthorizedException('Webhook secret not configured');
    }

    const payload = (req.body as Buffer).toString();

    const wh = new Webhook(webhookSecret);

    let event: any;

    try {
      event = wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch (err) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // DELEGATED BUSINESS LOGIC
    await this.webhookService.handleEvent(event);

    return { success: true };
  }
}
