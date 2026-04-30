import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Tourvista Tours | Core API')
    .setDescription(
      `
        ## 🚀 Welcome to the Tourvista API
        This API manages the complete travel lifecycle, from package discovery to secure booking.
        
        ### 🔑 Authentication
        - **User/Admin:** Authenticated via **Clerk JWT**. 
        - **Webhooks:** Secured via signature verification (Clerk/WebXPay).
        
        ### 📡 Core Workflows
        - **Tours:** Management of tour packages and itineraries.
        - **Bookings:** Handling reservations and payment states with **WebXPay**.
        - **Inquiries:** Direct client-to-admin messaging system.
        - **Sync:** Automated Clerk-to-Database synchronization via webhooks.
        
        *Refer to the "Schemas" section at the bottom for full data model specifications.*
      `,
    )
    .setVersion('1.0.0')
    .setContact(
      'Softro Code Labs Tech Team',
      'https://softrocodelabs.com/support',
      'dev@softrocodelabs.com',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter your Clerk JWT token here',
        in: 'header',
      },
      'clerk-auth',
    )
    .addTag(
      'Tours',
      'Catalog discovery for guests and inventory management for administrators',
    )
    .addTag(
      'Bookings',
      'Reservation lifecycle: User history and Administrative oversight with status control',
    )
    .addTag(
      'Contact',
      'Lead generation via contact forms and Admin dashboard for inquiry processing',
    )
    .addTag(
      'Payments',
      'Financial transaction processing via WebXPay integration',
    )
    .addTag('Webhook', 'Automated data synchronization for Clerk users')
    .addTag(
      'App',
      'Infrastructure utilities, including health checks and service heartbeat',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
    },
    customSiteTitle: 'Tourvista Tours API Docs',
  });
}
