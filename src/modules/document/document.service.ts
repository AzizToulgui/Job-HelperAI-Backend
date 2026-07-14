import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { PrismaService } from '../../prisma/prisma.service';
import { OcrService } from '../../services/ocr.service';
import { EmbeddingService } from '../../services/embedding.service';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private prisma: PrismaService,
    private ocr: OcrService,
    private embedding: EmbeddingService,
  ) {}

  async upload(userId: string, file: Express.Multer.File, title: string) {
    if (!file || file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }

    this.logger.log(`Uploading document: "${title}" for user ${userId}`);

    const buffer = fs.readFileSync(file.path);
    const text = await this.ocr.extractText(buffer);

    const document = await this.prisma.document.create({
      data: { title, content: text, filePath: file.path, userId },
    });

    const chunks = this.createChunks(text, 600);
    this.logger.log(
      `Document created (${document.id}): ${chunks.length} chunks`,
    );

    for (let i = 0; i < chunks.length; i++) {
      const embeddingArray = await this.embedding.generate(chunks[i]);

      await this.prisma.documentChunk.create({
        data: {
          documentId: document.id,
          content: chunks[i],
          embedding: embeddingArray.map((n) => n.toString()),
          chunkIndex: i,
        },
      });

      this.logger.debug(`Chunk ${i + 1}/${chunks.length} embedded`);
    }

    this.logger.log(
      `Document "${title}" processed successfully (${chunks.length} chunks)`,
    );
    return {
      id: document.id,
      title,
      filePath: file.path,
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
    this.logger.debug(
      `Searching chunks: query="${query.substring(0, 50)}...", documentId=${documentId || 'all'}, limit=${limit}`,
    );

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
        similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    this.logger.log(
      `Search returned ${ranked.length} chunks (top similarity: ${ranked[0]?.similarity.toFixed(4) || 'N/A'})`,
    );

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
