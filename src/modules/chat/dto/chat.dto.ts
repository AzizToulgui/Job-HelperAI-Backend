import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class SendMessageDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsString()
  chatId?: string;

  @IsOptional()
  @IsBoolean()
  generatePdf?: boolean;

  @IsOptional()
  @IsBoolean()
  editPdf?: boolean;
}

export class MessageDto {
  role: 'user' | 'assistant';
  content: string;
}
