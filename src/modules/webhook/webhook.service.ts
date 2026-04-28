import { Inject, Injectable } from '@nestjs/common';
import type { ClerkClient } from '@clerk/backend';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

import { ClerkWebhookEvent } from '../../common/enums/event.enum';
import { UserRole } from '../../common/enums/role.enum';

@Injectable()
export class WebhookService {
  constructor(
    private prisma: PrismaService,

    @Inject('CLERK_CLIENT')
    private clerkClient: ClerkClient,
  ) {}

  async handleEvent(event: any) {
    switch (event.type) {
      case ClerkWebhookEvent.USER_CREATED: {
        const user = event.data;

        await this.prisma.user.create({
          data: {
            id: user.id,
            email: user.email_addresses[0]?.email_address,
            firstName: user.first_name ?? '',
            lastName: user.last_name ?? '',
            role: UserRole.USER,
          },
        });

        await this.clerkClient.users.updateUserMetadata(user.id, {
          publicMetadata: {
            role: UserRole.USER,
          },
        });

        break;
      }

      case ClerkWebhookEvent.USER_UPDATED: {
        const user = event.data;

        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            email: user.email_addresses[0]?.email_address,
            firstName: user.first_name ?? '',
            lastName: user.last_name ?? '',
            role: (user.public_metadata?.role as UserRole) || UserRole.USER,
          },
        });

        break;
      }

      case ClerkWebhookEvent.USER_DELETED: {
        const user = event.data;

        await this.prisma.user.delete({
          where: { id: user.id },
        });

        break;
      }
    }
  }
}
