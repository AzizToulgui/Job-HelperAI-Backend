import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MistralService } from '../../services/mistral.service';
import { DocumentService } from '../document/document.service';
import { SendMessageDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private mistral: MistralService,
    private documentService: DocumentService,
  ) {}

  async sendMessage(userId: string, dto: SendMessageDto) {
    this.logger.log(
      `New message from user ${userId}${dto.documentId ? ` (document: ${dto.documentId})` : ''}`,
    );

    let chatId = dto.chatId;

    if (!chatId) {
      const chat = await this.prisma.chat.create({
        data: { userId, title: dto.message.substring(0, 60) },
      });
      chatId = chat.id;
      this.logger.log(`Created new chat ${chatId}`);
    }

    await this.prisma.message.create({
      data: { chatId, role: 'user', content: dto.message },
    });

    let context = '';
    if (dto.documentId) {
      this.logger.debug(`Retrieving context for document ${dto.documentId}`);
      const chunks = await this.documentService.searchChunks(
        dto.message,
        dto.documentId,
      );
      context = (chunks as any[]).map((c: any) => c.content).join('\n\n');
      this.logger.debug(
        `Context retrieved: ${chunks.length} chunks, ${context.length} chars`,
      );
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
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: dto.message },
    ];

    this.logger.debug(`Calling Mistral with ${messages.length} messages`);
    const responseText = await this.mistral.complete(messages);

    await this.prisma.message.create({
      data: { chatId, role: 'assistant', content: responseText },
    });

    this.logger.log(
      `Response sent for chat ${chatId} (${responseText.length} chars)`,
    );
    return { chatId, response: responseText };
  }

  async getChat(chatId: string) {
    this.logger.log(`GET /chat/${chatId}`);
    return this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }
}
