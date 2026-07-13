import { Injectable } from '@nestjs/common';
import { Mistral } from '@mistralai/mistralai';
import * as puppeteer from 'puppeteer';

@Injectable()
export class PdfGeneratorService {
  private mistral: Mistral;

  constructor() {
    this.mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });
  }

  async generatePdf(prompt: string, title = 'Generated Document') {
    const htmlPrompt = `Create a complete, professional, well-formatted HTML document (using Tailwind CSS via CDN) about: "${prompt}".
Include <head> with title "${title}", proper structure, headings, paragraphs, and nice styling.`;

    const res = await this.mistral.chat.complete({
      model: 'mistral-large-latest',
      messages: [{ role: 'user', content: htmlPrompt }],
    });

    let htmlContent =
      res.choices[0].message!.content || '<h1>Error generating content</h1>';

    // Type guard to check if content is a string
    if (typeof htmlContent === 'string') {
      htmlContent = htmlContent.replace(/```html|```/gi, '').trim();
    } else {
      // Handle ContentChunk[] case - convert to string or handle differently
      htmlContent = 'Error: Content format not supported for PDF generation';
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-white p-8">
        ${htmlContent}
      </body>
      </html>`;

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Use 'load' instead of 'networkidle0'
    await page.setContent(fullHtml, { waitUntil: 'load' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '30px', right: '30px', bottom: '40px', left: '30px' },
    });

    await browser.close();

    return { pdfBuffer, html: fullHtml };
  }
}
