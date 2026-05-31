import { ConfigService } from '@nestjs/config';

export const PayhereProvider = {
  provide: 'PAYHERE',
  useFactory: (configService: ConfigService) => {
    return {
      merchantId: configService.get<string>('PAYHERE_MERCHANT_ID'),
      merchantSecret: configService.get<string>('PAYHERE_MERCHANT_SECRET'),
    };
  },
  inject: [ConfigService],
};
