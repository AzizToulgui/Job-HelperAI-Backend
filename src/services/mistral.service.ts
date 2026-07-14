import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';

@Injectable()
export class MistralService {
  private readonly logger = new Logger(MistralService.name);
  private client: Mistral;

  constructor(private config: ConfigService) {
    this.client = new Mistral({
      apiKey: this.config.get<string>('MISTRAL_API_KEY'),
    });
    this.logger.log('Mistral AI client initialized');
  }

  async complete(
    messages: any[],
    temperature = 0.7,
    maxTokens = 1024,
  ): Promise<string> {
    this.logger.debug(
      `Calling Mistral: ${messages.length} messages, temp=${temperature}, maxTokens=${maxTokens}`,
    );

    const startTime = Date.now();
    const response = await this.client.chat.complete({
      model: 'mistral-large-latest',
      messages,
      temperature,
      maxTokens,
    });

    const content = response.choices[0]?.message?.content;
    const duration = Date.now() - startTime;

    if (!content) {
      this.logger.warn(`Mistral returned empty response (${duration}ms)`);
      return '';
    }

    const text =
      typeof content === 'string'
        ? content
        : content
            .filter((chunk) => chunk.type === 'text')
            .map((chunk) => chunk.text)
            .join('');

    this.logger.log(
      `Mistral response received (${text.length} chars, ${duration}ms)`,
    );
    return text;
  }
}
