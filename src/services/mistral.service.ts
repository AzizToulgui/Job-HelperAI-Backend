import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';

@Injectable()
export class MistralService {
  private client: Mistral;

  constructor(private config: ConfigService) {
    this.client = new Mistral({
      apiKey: this.config.get<string>('MISTRAL_API_KEY'),
    });
  }

  async complete(
    messages: any[],
    temperature = 0.7,
    maxTokens = 1024,
  ): Promise<string> {
    const response = await this.client.chat.complete({
      model: 'mistral-large-latest',
      messages,
      temperature,
      maxTokens,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return '';
    }

    if (typeof content === 'string') {
      return content;
    }

    return content
      .filter((chunk) => chunk.type === 'text')
      .map((chunk) => chunk.text)
      .join('');
  }
}
