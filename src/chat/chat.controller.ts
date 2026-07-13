import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('session')
  async createSession() {
    const session = await this.chatService.createSession();
    return { sessionId: session.id };
  }

  @Post('message')
  async sendMessage(
    @Body() body: { sessionId: string; message: string; documentId?: string },
  ) {
    const { sessionId, message, documentId } = body;
    if (!sessionId || !message) {
      throw new Error('sessionId and message are required');
    }
    return this.chatService.sendMessage(sessionId, message, documentId);
  }
}
