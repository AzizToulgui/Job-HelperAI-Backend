import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Req,
  Logger,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/chat.dto';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  async sendMessage(@Body() dto: SendMessageDto, @Req() req: any) {
    this.logger.log(`POST /chat/message - chatId=${dto.chatId || 'new'}`);
    return this.chatService.sendMessage(req.user?.id || 'demo-user', dto);
  }

  @Get(':chatId')
  async getChat(@Param('chatId') chatId: string) {
    this.logger.log(`GET /chat/${chatId}`);
    return this.chatService.getChat(chatId);
  }
}
