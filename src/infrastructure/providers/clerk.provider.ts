import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';

export const ClerkClientProvider = {
  provide: 'CLERK_CLIENT',
  useFactory: (configService: ConfigService) => {
    return createClerkClient({
      publishableKey: configService.get<string>('CLERK_PUBLISHABLE_KEY'),
      secretKey: configService.get<string>('CLERK_SECRET_KEY'),
    });
  },
  inject: [ConfigService],
};
