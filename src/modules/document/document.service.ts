import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OcrService } from '../../services/ocr.service';
import { EmbeddingService } from '../../services/embedding.service';

@Injectable()
export class DocumentService {
  constructor(
    private prisma: PrismaService,
    private ocr: OcrService,
    private embedding: EmbeddingService,
  ) {}

  async upload(userId: string, file: Express.Multer.File, title: string) {
    if (!file || file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    const text = await this.ocr.extractText(file.buffer);

    const document = await this.prisma.document.create({
      data: { title, content: text, userId },
    });

    const chunks = this.createChunks(text, 600);

    for (let i = 0; i < chunks.length; i++) {
      const embeddingArray = await this.embedding.generate(chunks[i]);

      await this.prisma.documentChunk.create({
        data: {
          documentId: document.id,
          content: chunks[i],
          embedding: embeddingArray.map((n) => n.toString()), // Convert to string[]
          chunkIndex: i,
        },
      });
    }

    return {
      id: document.id,
      title,
      processed: true,
      chunksCount: chunks.length,
    };
  }

  private createChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end).trim());
      start = end;
    }
    return chunks;
  }

  async getDocument(id: string) {
    return this.prisma.document.findUnique({
      where: { id },
      include: { chunks: true },
    });
  }

  async searchChunks(query: string, documentId?: string, limit = 6) {
    const queryEmbedding = await this.embedding.generate(query);

    const results = await this.prisma.documentChunk.findMany({
      where: documentId ? { documentId } : undefined,
      select: {
        id: true,
        content: true,
        documentId: true,
        embedding: true,
      },
      take: limit * 3,
    });

    const ranked = results
      .map((chunk) => ({
        ...chunk,
        similarity: this.cosineSimilarity(
          queryEmbedding,
          chunk.embedding as string[],
        ),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return ranked;
  }

  private cosineSimilarity(vecA: number[], vecB: string[]): number {
    const vecBNum = vecB.map(Number);
    if (vecA.length !== vecBNum.length) return 0;

    let dot = 0,
      magA = 0,
      magB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecBNum[i];
      magA += vecA[i] * vecA[i];
      magB += vecBNum[i] * vecBNum[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
  }
}
