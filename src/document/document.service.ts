import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PDFParse } from 'pdf-parse';
import { Mistral } from '@mistralai/mistralai';
import * as fs from 'fs';
import { Prisma } from '@prisma/client';
import { ChunkResult } from '../types/chunk.types';

@Injectable()
export class DocumentService {
  private mistral: Mistral;

  constructor(private prisma: PrismaService) {
    this.mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });
  }

  async uploadAndProcess(file: Express.Multer.File) {
    const doc = await this.prisma.document.create({
      data: {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
      },
    });

    const dataBuffer = fs.readFileSync(file.path);
    const parser = new PDFParse({ data: dataBuffer });
    const pdfData = await parser.getText();

    const fullText = pdfData.text;

    const chunks = this.chunkText(fullText, 600, 100);
    for (const chunk of chunks) {
      const embeddingRes = await this.mistral.embeddings.create({
        model: 'mistral-embed',
        inputs: [chunk],
      });

      const embedding = embeddingRes.data[0].embedding;

      await this.prisma.$executeRaw`
        INSERT INTO "Chunk" (id, "documentId", content, embedding)
        VALUES (gen_random_uuid(), ${doc.id}, ${chunk}, ${embedding}::vector)
      `;
    }

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    return {
      documentId: doc.id,
      filename: doc.originalName,
      chunksCount: chunks.length,
    };
  }

  private chunkText(
    text: string,
    chunkSize: number,
    overlap: number,
  ): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end).trim());
      start = end - overlap;
      if (start < 0) break;
    }
    return chunks.filter((c) => c.length > 20);
  }

  async findRelevantChunks(
    query: string,
    topK = 6,
    documentId?: string,
  ): Promise<ChunkResult[]> {
    const embeddingRes = await this.mistral.embeddings.create({
      model: 'mistral-embed',
      inputs: [query],
    });
    const queryEmbedding = embeddingRes.data[0].embedding;

    const whereClause = documentId ? `AND "documentId" = '${documentId}'` : '';

    // Cast the result to ChunkResult[]
    const results = await this.prisma.$queryRaw<ChunkResult[]>`
      SELECT id, content, "documentId", 
             1 - (embedding <=> ${queryEmbedding}::vector) as similarity
      FROM "Chunk"
      WHERE 1=1 ${Prisma.sql([whereClause])}
      ORDER BY similarity DESC
      LIMIT ${topK}
    `;

    return results;
  }
}
