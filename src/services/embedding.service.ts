import { Injectable, OnModuleInit } from '@nestjs/common';
import { pipeline } from '@xenova/transformers';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private extractor: any;

  async onModuleInit() {
    this.extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
    );
  }

  async generate(text: string): Promise<number[]> {
    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(output.data);
  }
}
