import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { DocumentModule } from '../document/document.module';
import { MistralService } from 'src/services/mistral.service';
import { PdfGenerationService } from 'src/services/pdf-generation.service';
import { CloudConvertService } from 'src/services/cloudconvert.service';
import { PdfEditService } from 'src/services/pdf-edit.service';

@Module({
  imports: [DocumentModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    MistralService,
    PdfGenerationService,
    CloudConvertService,
    PdfEditService,
  ],
})
export class ChatModule {}
