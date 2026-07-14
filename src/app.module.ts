import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { ChatModule } from './modules/chat/chat.module';
import { DocumentModule } from './modules/document/document.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { MistralService } from './services/mistral.service';
import { EmbeddingService } from './services/embedding.service';
import { OcrService } from './services/ocr.service';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ChatModule,
    DocumentModule,
    UserModule,
    AuthModule,
    PrismaModule,
  ],
  providers: [PrismaService, MistralService, EmbeddingService, OcrService],
  exports: [PrismaService],
})
export class AppModule {}
