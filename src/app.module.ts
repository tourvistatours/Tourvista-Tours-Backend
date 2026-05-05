import Joi from 'joi';

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { ToursModule } from './modules/tours/tours.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ContactModule } from './modules/contact/contact.module';

import { AuthGuard } from './auth/guards/auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

import { ClerkClientProvider } from './infrastructure/providers/clerk.provider';
import { CloudinaryModule } from './infrastructure/cloudinary/cloudinary.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttractionsModule } from './modules/attractions/attractions.module';
import { CultureModule } from './modules/culture/culture.module';
import { ShowcasesModule } from './modules/showcases/showcases.module';

@Module({
  imports: [
    // ⚙️ Global config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        PORT: Joi.number().required(),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),

        CORS_ORIGIN: Joi.string().required(),

        DATABASE_URL: Joi.string().required(),

        CLOUDINARY_CLOUD_NAME: Joi.string().required(),
        CLOUDINARY_API_KEY: Joi.string().required(),
        CLOUDINARY_API_SECRET: Joi.string().required(),

        CLERK_PUBLISHABLE_KEY: Joi.string().required(),
        CLERK_SECRET_KEY: Joi.string().required(),
        CLERK_WEBHOOK_SECRET: Joi.string().required(),
      }),
    }),

    // 📦 Database modules
    PrismaModule,
    CloudinaryModule,

    // 🧩 Feature modules
    WebhookModule,
    ToursModule,
    BookingsModule,
    PaymentsModule,
    ContactModule,
    AttractionsModule,
    CultureModule,
    ShowcasesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // 🔑 Clerk
    ClerkClientProvider,

    // 🔐 Auth guard (global)
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },

    // 🛡️ Role guard (global)
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
