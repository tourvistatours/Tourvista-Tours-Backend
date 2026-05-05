import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Tourvista Tours | Core API')
    .setDescription(
      `
      ## 🚀 Welcome to the Tourvista API
      This API manages the complete travel lifecycle, from discovery to secure booking.

      ### 🔑 Authentication
      - **User/Admin:** All protected routes require a **Clerk JWT**. 
      - Use the **Authorize** button below and enter your token as \`Bearer <token>\`.

      ### 📡 Key Features
      - **Tours & Attractions:** Managed inventory with Cloudinary image integration.
      - **Bookings:** Lifecycle management integrated with **WebXPay**.
      - **Webhooks:** Automated Clerk-to-DB synchronization.
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
        description: 'Enter your Clerk JWT token',
      },
      'clerk-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 1,
    },
    customSiteTitle: 'Tourvista Tours API Docs',
  });
}
