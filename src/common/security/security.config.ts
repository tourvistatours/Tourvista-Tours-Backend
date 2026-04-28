import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

import { rateLimiter } from './throttler.config';
import { sanitizeMiddleware } from './sanitize.config';

export function setupSecurity(app: INestApplication) {
  const expressApp = app.getHttpAdapter().getInstance();

  // 🔐 Hide Express info
  expressApp.disable('x-powered-by');

  // 🛡️ Security headers
  app.use(helmet());

  // 🚫 Rate limiting (with whitelist)
  app.use(rateLimiter);

  // 🧼 Custom sanitization middleware
  app.use(sanitizeMiddleware);

  // 🧪 Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
