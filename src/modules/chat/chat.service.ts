import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MistralService } from '../../services/mistral.service';
import { DocumentService } from '../document/document.service';
import { PdfGenerationService } from '../../services/pdf-generation.service';
import { SendMessageDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private mistral: MistralService,
    private documentService: DocumentService,
    private pdfGenerationService: PdfGenerationService,
  ) {}

  async sendMessage(userId: string, dto: SendMessageDto) {
    this.logger.log(
      `New message from user ${userId}${dto.documentId ? ` (document: ${dto.documentId})` : '(no document)'}${dto.generatePdf ? ' (PDF generation)' : ''}`,
    );
    this.logger.log(`DTO received: ${JSON.stringify({ message: dto.message?.substring(0, 50), documentId: dto.documentId, chatId: dto.chatId, generatePdf: dto.generatePdf })}`);

    let chatId = dto.chatId;

    if (!chatId) {
      const chat = await this.prisma.chat.create({
        data: { userId, title: dto.message.substring(0, 60) },
      });
      chatId = chat.id;
      this.logger.log(`Created new chat ${chatId}`);
    }

    await this.prisma.message.create({
      data: {
        chatId,
        role: 'user',
        content: dto.message,
        documentId: dto.documentId,
      },
    });

    // PDF Generation flow
    if (dto.generatePdf) {
      this.logger.log('Entering PDF generation flow');
      try {
        const result = await this.pdfGenerationService.generatePDF(dto.message);

        const responseText = `I've generated your PDF based on your description. You can download it using the button below.`;

        await this.prisma.message.create({
          data: { chatId, role: 'assistant', content: responseText },
        });

        this.logger.log(`PDF generated for chat ${chatId}: ${result.fileName}`);
        return {
          chatId,
          response: responseText,
          pdfUrl: `/documents/download/${result.fileName}`,
          pdfFileName: result.fileName,
        };
      } catch (err) {
        this.logger.error(`PDF generation failed: ${err}`);
        const errorText = 'Sorry, PDF generation failed. Please try again with a different description.';

        await this.prisma.message.create({
          data: { chatId, role: 'assistant', content: errorText },
        });

        return { chatId, response: errorText };
      }
    }

    // Normal chat flow

    let context = '';
    if (dto.documentId) {
      this.logger.log(`Retrieving context for document ${dto.documentId}`);
      try {
        const chunks = await this.documentService.searchChunks(
          dto.message,
          dto.documentId,
        );
        context = (chunks as any[]).map((c: any) => c.content).join('\n\n');
        this.logger.log(
          `Context retrieved: ${chunks.length} chunks, ${context.length} chars`,
        );
        if (chunks.length > 0) {
          this.logger.debug(`First chunk preview: ${(chunks[0] as any).content?.substring(0, 100)}`);
        }
      } catch (err) {
        this.logger.error(`Failed to retrieve context: ${err}`);
      }
    } else {
      this.logger.warn('No documentId provided - sending without document context');
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
    ];

    this.logger.log(`Calling Mistral with ${messages.length} messages, context length: ${context.length} chars`);
    this.logger.debug(`System prompt preview: ${messages[0]?.content?.substring(0, 200)}`);
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
