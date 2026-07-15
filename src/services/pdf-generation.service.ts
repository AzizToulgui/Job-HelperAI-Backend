import { Injectable, Logger } from '@nestjs/common';
import { MistralService } from './mistral.service';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PdfGenerationService {
  private readonly logger = new Logger(PdfGenerationService.name);

  constructor(private mistral: MistralService) {}

  async generateHTML(prompt: string): Promise<string> {
    this.logger.log(`Generating HTML for prompt: ${prompt.substring(0, 80)}...`);

    const systemPrompt = `You are an expert web developer. Generate a complete, self-contained HTML document based on the user's description.

Rules:
- Output ONLY the raw HTML. No markdown, no code fences, no explanations.
- Include all CSS in a <style> tag inside <head>.
- Use modern, clean, professional styling.
- The document must be valid HTML5 starting with <!DOCTYPE html>.
- Use A4 page dimensions optimized for print (210mm x 297mm).
- Include @page CSS rules for proper print margins.
- Use @media print rules where appropriate.
- Use system fonts (Segoe UI, Arial, Helvetica, sans-serif) for reliability.
- Support both text content and data tables if relevant.
- Use proper page-break-inside: avoid for content blocks.
- Colors should be print-friendly (avoid very light colors).
- Include proper meta charset and viewport tags.`;

    const html = await this.mistral.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      0.4,
      4096,
    );

    let cleaned = html.trim();

    // Strip markdown code fences if the model wraps output
    if (cleaned.startsWith('```html')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    // Ensure it starts with DOCTYPE
    if (!cleaned.toLowerCase().startsWith('<!doctype')) {
      cleaned = `<!DOCTYPE html>\n${cleaned}`;
    }

    this.logger.log(`HTML generated (${cleaned.length} chars)`);
    return cleaned;
  }

  async htmlToPdf(html: string): Promise<{ filePath: string; fileName: string }> {
    this.logger.log('Launching Puppeteer for PDF generation...');

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    try {
      const page = await browser.newPage();

      await page.setContent(html, {
        waitUntil: 'load',
        timeout: 30000,
      });

      const fileName = `generated-${uuidv4()}.pdf`;
      const filePath = path.join(process.cwd(), 'uploads', fileName);

      await page.pdf({
        path: filePath,
        format: 'A4',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        printBackground: true,
        preferCSSPageSize: false,
      });

      this.logger.log(`PDF saved to ${filePath}`);
      return { filePath, fileName };
    } finally {
      await browser.close();
    }
  }

  async generatePDF(
    prompt: string,
  ): Promise<{ filePath: string; fileName: string; htmlPreview: string }> {
    this.logger.log(`Starting PDF generation pipeline...`);

    const html = await this.generateHTML(prompt);
    const result = await this.htmlToPdf(html);

    this.logger.log(`PDF generation complete: ${result.fileName}`);
    return { ...result, htmlPreview: html };
  }
}
