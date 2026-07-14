import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';

export interface ClerkUser {
  id: string;
  email: string;
}

@Injectable()
export class JwtStrategy {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly configService: ConfigService) {}

  async verify(authHeader: string | undefined): Promise<ClerkUser> {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const clerkSecretKey = this.configService.get<string>('CLERK_SECRET_KEY');
      if (!clerkSecretKey) {
        throw new Error('CLERK_SECRET_KEY environment variable is not set');
      }

      const payload = await verifyToken(token, {
        secretKey: clerkSecretKey,
      });

      this.logger.debug(`Clerk token verified for user="${payload.sub}"`);

      return {
        id: payload.sub,
        email: (payload.email as string) || '',
      };
    } catch (error) {
      this.logger.warn(`Token verification failed: ${error}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
