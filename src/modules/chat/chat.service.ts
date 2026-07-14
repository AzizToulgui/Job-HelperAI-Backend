import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MistralService } from '../../services/mistral.service';
import { DocumentService } from '../document/document.service';
import { SendMessageDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private mistral: MistralService,
    private documentService: DocumentService,
  ) {}

  async sendMessage(userId: string, dto: SendMessageDto) {
    let chatId = dto.chatId;

    if (!chatId) {
      const chat = await this.prisma.chat.create({
        data: { userId, title: dto.message.substring(0, 60) },
      });
      chatId = chat.id;
    }

    // Save user message
    await this.prisma.message.create({
      data: { chatId, role: 'user', content: dto.message },
    });

    let context = '';
    if (dto.documentId) {
      const chunks = await this.documentService.searchChunks(
        dto.message,
        dto.documentId,
      );
      context = (chunks as any[]).map((c: any) => c.content).join('\n\n');
    }

    const history = await this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      take: 12,
    });

    const messages = [
      {
        role: 'system',
        content: context
          ? `You are a helpful assistant. Answer using this context from the uploaded document:\n${context}`
          : 'You are a helpful assistant.',
      },
      ...history.map((m) => ({ role: m.role as any, content: m.content })),
      { role: 'user', content: dto.message },
    ];

    const responseText = await this.mistral.complete(messages);

    await this.prisma.message.create({
      data: { chatId, role: 'assistant', content: responseText },
    });

    return { chatId, response: responseText };
  }

  async getChat(chatId: string) {
    return this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }
}
