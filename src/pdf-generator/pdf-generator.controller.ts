import { Controller, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PdfGeneratorService } from './pdf-generator.service';

@Controller('pdf')
export class PdfGeneratorController {
  constructor(private readonly pdfService: PdfGeneratorService) {}

  @Post('generate')
  async generate(
    @Body() body: { prompt: string; title?: string },
    @Res() res: Response,
  ) {
    const { pdfBuffer } = await this.pdfService.generatePdf(
      body.prompt,
      body.title,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="generated-${Date.now()}.pdf"`,
    });
    res.send(pdfBuffer);
  }
}
