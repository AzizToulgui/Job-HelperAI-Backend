import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getProfile(@Req() req: any) {
    this.logger.log(`GET /users/me - userId="${req.user.id}"`);
    return this.userService.findById(req.user.id);
  }

  @Patch('me')
  async updateProfile(@Req() req: any, @Body() dto: UpdateUserDto) {
    this.logger.log(`PATCH /users/me - userId="${req.user.id}"`);
    return this.userService.update(req.user.id, dto);
  }
}
