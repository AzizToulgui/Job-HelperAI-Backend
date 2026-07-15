import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

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
}

export class MessageDto {
  role: 'user' | 'assistant';
  content: string;
}
