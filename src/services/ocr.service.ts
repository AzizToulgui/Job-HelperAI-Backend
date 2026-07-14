import { Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { fromBuffer } from 'pdf2pic';
import { createWorker } from 'tesseract.js';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  async extractText(buffer: Buffer): Promise<string> {
    this.logger.log(`Extracting text from PDF (${buffer.length} bytes)`);

    try {
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();
      await parser.destroy();

      if (data.text && data.text.trim().length > 50) {
        this.logger.log(
          `PDF text extracted directly (${data.text.length} chars)`,
        );
        return data.text;
      }
    } catch (e) {
      this.logger.debug(
        'PDF direct text extraction failed, falling back to OCR',
      );
    }

    this.logger.log('Starting OCR processing');

    const converter = fromBuffer(buffer, {
      density: 300,
      format: 'png',
      width: 1200,
    });

    const worker = await createWorker('eng');

    let fullText = '';
    let page = 1;

    while (true) {
      try {
        const result = await converter(page);

        if (!result.path) {
          break;
        }

        const { data } = await worker.recognize(result.path);
        fullText += data.text + '\n\n';

        this.logger.debug(`OCR page ${page} processed`);
        page++;
      } catch {
        break;
      }
    }

    await worker.terminate();

    this.logger.log(
      `OCR completed: ${page - 1} pages, ${fullText.length} chars extracted`,
    );
    return fullText.trim();
  }
}
