import { IsString, IsOptional, IsArray } from 'class-validator';

export class SendMessageDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsString()
  chatId?: string;
}

export class MessageDto {
  role: 'user' | 'assistant';
  content: string;
}
