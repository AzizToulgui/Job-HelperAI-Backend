import { PrismaService } from './prisma.service';

export async function vectorSearch(
  prisma: PrismaService,
  queryEmbedding: number[],
  documentId?: string,
  limit = 6,
) {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  if (documentId) {
    return prisma.$queryRawUnsafe(
      `
      SELECT 
        id, 
        content, 
        "documentId",
        embedding <=> $1::vector AS distance
      FROM "DocumentChunk"
      WHERE "documentId" = $2
      ORDER BY distance ASC
      LIMIT $3;
    `,
      embeddingStr,
      documentId,
      limit,
    );
  } else {
    return prisma.$queryRawUnsafe(
      `
      SELECT 
        id, 
        content, 
        "documentId",
        embedding <=> $1::vector AS distance
      FROM "DocumentChunk"
      ORDER BY distance ASC
      LIMIT $2;
    `,
      embeddingStr,
      limit,
    );
  }
}
