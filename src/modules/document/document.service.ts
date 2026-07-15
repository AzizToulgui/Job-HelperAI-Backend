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
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');
    const isText =
      file.mimetype.startsWith('text/') ||
      file.mimetype === 'application/json' ||
      /\.(txt|md|csv|json|js|ts|py|html|css|xml|yaml|yml)$/i.test(
        file.originalname,
      );

    if (!isPdf && !isText) {
      throw new BadRequestException(
        'Only PDF and text files are allowed',
      );
    }

    this.logger.log(`Uploading document: "${title}" (${file.mimetype}) for user ${userId}`);

    const buffer = fs.readFileSync(file.path);
    let text: string;

    if (isPdf) {
      text = await this.ocr.extractText(buffer);
    } else {
      text = buffer.toString('utf-8');
    }

    this.logger.log(`Text extracted: ${text.length} chars`);

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

    const totalChunks = await this.prisma.documentChunk.count({
      where: { documentId: document.id },
    });
    this.logger.log(`Verified: ${totalChunks} chunks in DB for document ${document.id}`);

    await this.prisma.document.update({
      where: { id: document.id },
      data: { processed: true },
    });

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
    this.logger.log(
      `Searching chunks: query="${query.substring(0, 50)}...", documentId=${documentId || 'all'}, limit=${limit}`,
    );

    const queryEmbedding = await this.embedding.generate(query);
    this.logger.debug(`Query embedding generated (${queryEmbedding.length} dims)`);

    const totalCount = await this.prisma.documentChunk.count({
      where: documentId ? { documentId } : undefined,
    });
    this.logger.log(`Total chunks in DB for document ${documentId}: ${totalCount}`);

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

    this.logger.log(`Fetched ${results.length} chunks from DB`);

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
