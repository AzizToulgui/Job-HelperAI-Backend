import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtStrategy: JwtStrategy,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    try {
      const clerkUser = await this.jwtStrategy.verify(authHeader);

      const user = await this.authService.findOrCreateClerkUser(
        clerkUser.id,
        clerkUser.email,
      );

      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Unauthorized');
    }
  }
}
