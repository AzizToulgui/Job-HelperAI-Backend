export interface ChunkResult {
  id: string;
  content: string;
  documentId: string;
  similarity: number;
}

export interface SourceReference {
  id: string;
  content: string;
}
