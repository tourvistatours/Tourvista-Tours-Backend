import {
  Injectable,
  InternalServerErrorException,
  Logger,
  Inject,
} from '@nestjs/common';
import { SEYLAN_MPGS_CONFIG_TOKEN } from '../providers/seylan-mpgs.provider';
import type {
  SeylanMpgsConfig,
  SeylanCheckoutSessionResponse,
} from '../providers/seylan-mpgs.provider';

@Injectable()
export class SeylanMpgsService {
  private readonly logger = new Logger(SeylanMpgsService.name);
  private readonly baseGatewayUrl: string;

  constructor(
    @Inject(SEYLAN_MPGS_CONFIG_TOKEN)
    private readonly config: SeylanMpgsConfig,
  ) {
    this.baseGatewayUrl = `${this.config.gatewayUrl}/api/rest/version/${this.config.apiVersion}/merchant/${this.config.merchantId}`;
  }

  /**
   * Issues a secure server-to-server payload mapping initialization step to MPGS API
   */
  async initiateCheckoutSession(
    orderId: string,
    amount: number,
    currency: string = 'USD',
  ): Promise<SeylanCheckoutSessionResponse> {
    const sessionUrl = `${this.baseGatewayUrl}/session`;

    // Auth Basic Token Construction using isolated config properties
    const authCredentials = Buffer.from(
      `merchant.${this.config.merchantId}:${this.config.apiPassword}`,
    ).toString('base64');

    const requestBody = {
      apiOperation: 'INITIATE_CHECKOUT',
      interaction: {
        operation: 'PURCHASE',
        returnUrl: 'https://www.tourvistatours.com/reservations',
        merchant: {
          name: 'merchant.tourvistatours',
        },
      },
      order: {
        id: orderId,
        amount: amount.toFixed(2),
        currency: currency,
        description: 'Test order',
      },
    };

    // 1. Log Outbound Request Context & Body
    // this.logger.log(
    //   `[MPGS REQUEST] URL: ${sessionUrl} | Payload: ${JSON.stringify(requestBody)}`,
    // );

    try {
      const response = await fetch(sessionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authCredentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Seylan Gateway Initiation Rejection: Status ${response.status} | Payload: ${errorText}`,
        );
        throw new InternalServerErrorException(
          'Gateway communication execution fault.',
        );
      }

      // 2. Log Raw Inbound Response Details
      // const rawResponseText = await response.text();
      // this.logger.log(
      //   `[MPGS RESPONSE] Status: ${response.status} ${response.statusText} | Raw Body: ${rawResponseText}`,
      // );

      const responseData: SeylanCheckoutSessionResponse = await response.json();

      if (responseData.result === 'FAILURE') {
        throw new InternalServerErrorException(
          'Gateway denied structural session intent generation.',
        );
      }

      return responseData;
    } catch (error) {
      this.logger.error(
        `Failed executing transaction allocation setup context: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        'Payment runtime initialization fault.',
      );
    }
  }
}
