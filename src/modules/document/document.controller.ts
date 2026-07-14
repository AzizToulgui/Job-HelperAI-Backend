import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Get,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentService } from './document.service';
import { UploadDocumentDto } from './upload-document.dto';

@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    // Using demo user for now
    return this.documentService.upload('demo-user', file, dto.title);
  }

  @Get(':id')
  async getDocument(@Param('id') id: string) {
    return this.documentService.getDocument(id);
  }
}
