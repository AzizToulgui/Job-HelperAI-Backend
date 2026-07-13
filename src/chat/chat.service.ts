import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentService } from '../document/document.service';
import { Mistral } from '@mistralai/mistralai';

// Type guard to check if a chunk is a text chunk
function isTextChunk(chunk: any): chunk is { text: string } {
  return (
    chunk &&
    typeof chunk === 'object' &&
    'text' in chunk &&
    typeof chunk.text === 'string'
  );
}

// Function to extract text from content chunks
function extractTextFromContent(content: any): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((chunk) => isTextChunk(chunk))
      .map((chunk) => chunk.text)
      .join('');
  }

  return '';
}

@Injectable()
export class ChatService {
  private mistral: Mistral;

  constructor(
    private prisma: PrismaService,
    private documentService: DocumentService,
  ) {
    this.mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });
  }

  async createSession() {
    return this.prisma.chatSession.create({});
  }

  async sendMessage(sessionId: string, message: string, documentId?: string) {
    // Save user message
    await this.prisma.message.create({
      data: { sessionId, role: 'user', content: message },
    });

    const relevantChunks = await this.documentService.findRelevantChunks(
      message,
      6,
      documentId,
    );
    const context = relevantChunks
      .map((c: any) => c.content)
      .join('\n\n---\n\n');

    const systemPrompt = `You are a helpful assistant. Answer the question using only the provided context.
If the answer is not in the context, say you don't know.`;

    const response = await this.mistral.chat.complete({
      model: 'mistral-large-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${message}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    const answer =
      extractTextFromContent(content) ||
      'Sorry, I could not generate a response.';

    // Save assistant response
    await this.prisma.message.create({
      data: {
        sessionId,
        role: 'assistant',
        content: answer,
        sources: relevantChunks.map((c: any) => ({
          id: c.id,
          content: c.content.substring(0, 200),
        })),
      },
    });

    return { answer, sources: relevantChunks };
  }
}
