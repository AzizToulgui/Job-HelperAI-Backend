import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { pipeline } from '@xenova/transformers';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private extractor: any;

  async onModuleInit() {
    this.logger.log('Loading embedding model (all-MiniLM-L6-v2)...');
    const startTime = Date.now();
    this.extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
    );
    this.logger.log(`Embedding model loaded (${Date.now() - startTime}ms)`);
  }

  async generate(text: string): Promise<number[]> {
    this.logger.debug(`Generating embedding for text (${text.length} chars)`);
    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(output.data);
  }
}
