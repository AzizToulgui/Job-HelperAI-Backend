import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwtStrategy: JwtStrategy,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    let clerkUser;
    try {
      clerkUser = await this.jwtStrategy.verify(authHeader);
    } catch {
      throw new UnauthorizedException('Unauthorized');
    }

    try {
      const user = await this.authService.findOrCreateClerkUser(
        clerkUser.id,
        clerkUser.email,
      );
      request.user = user;
      return true;
    } catch (error) {
      this.logger.error(`Failed to find or create user: ${error}`);
      throw new UnauthorizedException('Failed to authenticate user');
    }
  }
}
