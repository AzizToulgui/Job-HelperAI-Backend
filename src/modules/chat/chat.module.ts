import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { DocumentModule } from '../document/document.module';
import { MistralService } from 'src/services/mistral.service';

@Module({
  imports: [DocumentModule],
  controllers: [ChatController],
  providers: [ChatService, MistralService],
})
export class ChatModule {}
