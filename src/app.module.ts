// src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { DocumentModule } from './document/document.module';
import { ChatModule } from './chat/chat.module';
import { PdfGeneratorModule } from './pdf-generator/df-generator.module';

@Module({
  imports: [DocumentModule, ChatModule, PdfGeneratorModule],
  providers: [PrismaService],
})
export class AppModule {}
