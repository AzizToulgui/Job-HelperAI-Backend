import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
  ) {}

  async findOrCreateClerkUser(clerkId: string, email: string, name?: string) {
    this.logger.log(`Finding or creating user for clerkId="${clerkId}"`);

    let user = await this.prisma.user.findUnique({
      where: { id: clerkId },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id: clerkId,
          email,
          name,
        },
      });
      this.logger.log(`Created new user: id="${clerkId}"`);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }
}
