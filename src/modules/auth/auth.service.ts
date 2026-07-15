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
    this.logger.log(`Finding or creating user for clerkId="${clerkId}" email="${email}"`);

    // 1. Try finding by Clerk ID
    let user = await this.prisma.user.findUnique({
      where: { id: clerkId },
    });

    if (user) {
      // Update email/name if they were previously empty
      const updates: Record<string, string> = {};
      if (email && !user.email) updates.email = email;
      if (name && !user.name) updates.name = name;
      if (Object.keys(updates).length > 0) {
        user = await this.prisma.user.update({ where: { id: clerkId }, data: updates });
      }
      return { id: user.id, email: user.email, name: user.name };
    }

    // 2. Try finding by email — only if email is non-empty
    if (email) {
      user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        this.logger.log(`Found existing user by email, linking clerkId="${clerkId}" to id="${user.id}"`);
        return { id: user.id, email: user.email, name: user.name };
      }
    }

    // 3. Create new user
    user = await this.prisma.user.create({
      data: { id: clerkId, email: email || `pending-${clerkId}@placeholder.local`, name },
    });
    this.logger.log(`Created new user: id="${clerkId}"`);
    return { id: user.id, email: user.email, name: user.name };
  }
}
