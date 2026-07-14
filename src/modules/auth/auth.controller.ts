import { Controller, Get, UseGuards, Req, Logger } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    this.logger.log(`GET /auth/me - userId="${req.user.id}"`);
    return req.user;
  }
}
