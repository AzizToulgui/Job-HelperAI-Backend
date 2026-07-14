import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Get,
  Param,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentService } from './document.service';
import { UploadDocumentDto } from './upload-document.dto';

const uploadsDir = path.join(process.cwd(), 'uploads');

@Controller('documents')
export class DocumentController implements OnModuleInit {
  private readonly logger = new Logger(DocumentController.name);

  constructor(private readonly documentService: DocumentService) {}

  onModuleInit() {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      this.logger.log('Created uploads directory');
    }
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    this.logger.log(
      `POST /documents/upload - title="${dto.title}", fileSize=${file?.size || 0} bytes`,
    );
    return this.documentService.upload('demo-user', file, dto.title);
  }

  @Get(':id')
  async getDocument(@Param('id') id: string) {
    this.logger.log(`GET /documents/${id}`);
    return this.documentService.getDocument(id);
  }
}
