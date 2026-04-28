import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import type { ClerkClient } from '@clerk/backend';

import { UserRole } from '../../common/enums/role.enum';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
    @Inject('CLERK_CLIENT') private clerkClient: ClerkClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. PUBLIC ROUTE CHECK
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    // 2. TOKEN CHECK
    const token = request.headers.authorization?.split(' ').pop();

    if (!token) throw new UnauthorizedException('Missing authorization token');

    // 3. VERIFY TOKEN
    const payload = await verifyToken(token, {
      secretKey: this.configService.get('CLERK_SECRET_KEY'),
    });

    // 4. GET USER FROM CLERK
    const user = await this.clerkClient.users.getUser(payload.sub);

    // 5. ATTACH USER
    request.user = {
      id: user.id,
      role: (user.publicMetadata as any)?.role || UserRole.USER,
    };

    return true;
  }
}
