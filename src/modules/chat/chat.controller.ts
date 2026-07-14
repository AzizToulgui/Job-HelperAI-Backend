import { Controller, Post, Body, Get, Param, Req } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  async sendMessage(@Body() dto: SendMessageDto, @Req() req: any) {
    return this.chatService.sendMessage(req.user?.id || 'demo-user', dto);
  }

  @Get(':chatId')
  async getChat(@Param('chatId') chatId: string) {
    return this.chatService.getChat(chatId);
  }
}
