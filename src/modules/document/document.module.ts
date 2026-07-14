import { Module } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { OcrService } from 'src/services/ocr.service';
import { EmbeddingService } from 'src/services/embedding.service';

@Module({
  controllers: [DocumentController],
  providers: [DocumentService, OcrService, EmbeddingService],
  exports: [DocumentService],
})
export class DocumentModule {}
