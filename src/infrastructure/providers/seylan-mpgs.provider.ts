import { ConfigService } from '@nestjs/config';

export interface SeylanMpgsConfig {
  merchantId: string;
  apiPassword: string;
  gatewayUrl: string;
  apiVersion: string;
}

export interface SeylanCheckoutSessionResponse {
  merchant: string;
  result: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'UNKNOWN';
  successIndicator: string;
  session: {
    id: string;
    updateStatus: 'SUCCESS' | 'FAILURE' | 'NO_UPDATE';
    version: string;
  };
}

export const SEYLAN_MPGS_CONFIG_TOKEN = 'SEYLAN_MPGS_CONFIG';

export const SeylanMpgsProvider = {
  provide: SEYLAN_MPGS_CONFIG_TOKEN,
  useFactory: (configService: ConfigService): SeylanMpgsConfig => {
    const baseInstanceUrl = configService.get<string>('SEYLAN_GATEWAY_URL');

    return {
      merchantId: configService.get<string>('SEYLAN_MERCHANT_ID') || '',
      apiPassword: configService.get<string>('SEYLAN_API_PASSWORD') || '',
      gatewayUrl: baseInstanceUrl || 'https://seylan.gateway.mastercard.com',
      apiVersion: '100',
    };
  },
  inject: [ConfigService],
};
