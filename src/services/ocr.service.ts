import { Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { fromBuffer } from 'pdf2pic';
import { createWorker } from 'tesseract.js';

@Injectable()
export class OcrService {
  async extractText(buffer: Buffer): Promise<string> {
    // Try normal PDF text extraction
    try {
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();

      await parser.destroy();

      if (data.text && data.text.trim().length > 50) {
        return data.text;
      }
    } catch (e) {}

    // OCR fallback
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

        page++;
      } catch {
        break;
      }
    }

    await worker.terminate();

    return fullText.trim();
  }
}
