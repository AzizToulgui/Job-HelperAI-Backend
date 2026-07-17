import {
  Controller,
  Post,
  Delete,
  Body,
  Get,
  Param,
  Req,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/chat.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Get()
  async getUserChats(@Req() req: any) {
    this.logger.log(`GET /chat - userId=${req.user.id}`);
    return this.chatService.getUserChats(req.user.id);
  }

  @Post('message')
  async sendMessage(@Body() dto: SendMessageDto, @Req() req: any) {
    this.logger.log(`POST /chat/message - chatId=${dto.chatId || 'new'}`);
    return this.chatService.sendMessage(req.user.id, dto);
  }

  @Get(':chatId')
  async getChat(@Param('chatId') chatId: string, @Req() req: any) {
    this.logger.log(`GET /chat/${chatId}`);
    return this.chatService.getChat(chatId, req.user.id);
  }

  @Delete(':chatId')
  async deleteChat(@Param('chatId') chatId: string, @Req() req: any) {
    this.logger.log(`DELETE /chat/${chatId}`);
    const result = await this.chatService.deleteChat(chatId, req.user.id);
    if (!result) {
      return { deleted: false, message: 'Chat not found' };
    }
    return result;
  }
}
