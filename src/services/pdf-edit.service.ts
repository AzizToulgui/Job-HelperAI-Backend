import { Injectable, Logger } from '@nestjs/common';
import { CloudConvertService } from './cloudconvert.service';
import { MistralService } from './mistral.service';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';

type Change =
  | { type: 'css'; selector: string; property: string; value: string }
  | { type: 'text'; selector: string; oldText: string; newText: string }
  | {
      type: 'attribute';
      selector: string;
      attribute: string;
      value: string;
    }
  | { type: 'replaceHTML'; selector: string; html: string }
  | { type: 'remove'; selector: string };

interface AiResponse {
  changes: Change[];
  error?: string;
}

@Injectable()
export class PdfEditService {
  private readonly logger = new Logger(PdfEditService.name);

  constructor(
    private cloudConvert: CloudConvertService,
    private mistral: MistralService,
  ) {}

  async editPdf(
    pdfFilePath: string,
    instruction: string,
  ): Promise<{ filePath: string; fileName: string }> {
    this.logger.log(
      `Starting PDF edit pipeline: ${instruction.substring(0, 80)}...`,
    );

    this.logger.log('Step 1/3: Converting PDF to HTML locally...');
    const html = await this.cloudConvert.convertPdfToHtml(pdfFilePath);
    this.logger.log(`PDF converted to HTML (${html.length} chars)`);

    this.logger.log('Step 2/3: Analyzing changes with AI...');
    const changes = await this.getChangesFromAI(html, instruction);
    this.logger.log(`AI returned ${changes.length} change(s)`);

    this.logger.log('Step 3/3: Applying changes and generating PDF...');
    const modifiedHtml = this.applyChanges(html, changes);
    this.logger.log(`Changes applied (${modifiedHtml.length} chars)`);

    const result = await this.htmlToPdf(modifiedHtml);

    this.logger.log(`PDF edit complete: ${result.fileName}`);
    return result;
  }

  private async getChangesFromAI(
    html: string,
    instruction: string,
  ): Promise<Change[]> {
    const systemPrompt = `You are an expert HTML editor. You will receive an HTML document and an instruction to modify it.

Your task is to analyze the HTML and return ONLY a JSON object describing the changes needed. Do NOT return the full HTML.

Available change types:

1. CSS property change:
   { "type": "css", "selector": "CSS_SELECTOR", "property": "CSS_PROPERTY", "value": "NEW_VALUE" }
   Example: { "type": "css", "selector": "h1", "property": "color", "value": "red" }

2. Text content change:
   { "type": "text", "selector": "CSS_SELECTOR", "oldText": "EXACT_OLD_TEXT", "newText": "NEW_TEXT" }
   Example: { "type": "text", "selector": "h1", "oldText": "Report", "newText": "Summary" }

3. Attribute change:
   { "type": "attribute", "selector": "CSS_SELECTOR", "attribute": "ATTR_NAME", "value": "NEW_VALUE" }
   Example: { "type": "attribute", "selector": "img.logo", "attribute": "src", "value": "/new-logo.png" }

4. Replace entire inner HTML of a section:
   { "type": "replaceHTML", "selector": "CSS_SELECTOR", "html": "NEW_HTML_CONTENT" }
   Example: { "type": "replaceHTML", "selector": ".header", "html": "<h1>New Header</h1><p>New subtitle</p>" }

5. Remove elements:
   { "type": "remove", "selector": "CSS_SELECTOR" }
   Example: { "type": "remove", "selector": "footer" }

Rules:
- Use specific CSS selectors (e.g., "h1.title", "#header", ".section > p")
- For CSS changes, only include the property being changed (we apply it as inline style)
- For text changes, provide the EXACT old text as it appears in the HTML
- For replaceHTML, provide the complete replacement HTML
- Return ONLY valid JSON, no markdown fences, no explanations
- If the instruction cannot be applied, return { "changes": [], "error": "reason" }
- You can combine multiple changes in one response
- Do NOT add changes the user didn't ask for`;

    const response = await this.mistral.complete(
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `HTML:\n${html}\n\n---\nInstruction: ${instruction}`,
        },
      ],
      0.2,
      2048,
    );

    this.logger.log(`AI response received (${response.length} chars)`);

    let cleaned = response.trim();

    // Strip markdown code fences if present
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned) as AiResponse;

    this.logger.log(
      `AI returned ${parsed.changes?.length || 0} change(s): ${JSON.stringify(parsed.changes)}`,
    );

    if (parsed.error) {
      this.logger.warn(`AI reported an issue: ${parsed.error}`);
    }

    return parsed.changes || [];
  }

  private applyChanges(html: string, changes: Change[]): string {
    if (changes.length === 0) {
      this.logger.warn('No changes to apply, returning original HTML');
      return html;
    }

    const $ = cheerio.load(html);

    for (const change of changes) {
      this.logger.debug(`Applying change: ${JSON.stringify(change)}`);

      const elements = $(change.selector);
      if (elements.length === 0) {
        this.logger.warn(`No elements found for selector: ${change.selector}`);
        continue;
      }

      switch (change.type) {
        case 'css':
          elements.each((_, el) => {
            const existing = $(el).attr('style') || '';
            const separator = existing.endsWith(';') ? ' ' : '; ';
            $(el).attr(
              'style',
              `${existing}${separator}${change.property}: ${change.value};`,
            );
          });
          break;

        case 'text':
          elements.each((_, el) => {
            const rawHtml = $(el).html() || '';
            const normalizedCurrent = $(el).text().replace(/\s+/g, ' ').trim();
            const normalizedOld = change.oldText.replace(/\s+/g, ' ').trim();

            if (!normalizedCurrent.includes(normalizedOld)) {
              this.logger.warn(
                `Old text not found in "${change.selector}". Expected: "${normalizedOld.substring(0, 100)}". Actual: "${normalizedCurrent.substring(0, 100)}"`,
              );
              return;
            }

            // Build a whitespace-tolerant regex from the normalized old text
            const fuzzyPattern = normalizedOld
              .split(/\s+/)
              .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
              .join('\\s+');
            const regex = new RegExp(fuzzyPattern);

            // Use AI's original newText (preserves its spacing)
            const newHtml = rawHtml.replace(regex, change.newText);
            this.logger.debug(
              `Text replacement in "${change.selector}": "${normalizedOld.substring(0, 60)}..." -> "${change.newText.substring(0, 60)}..."`,
            );
            $(el).html(newHtml);
          });
          break;

        case 'attribute':
          elements.each((_, el) => {
            $(el).attr(change.attribute, change.value);
          });
          break;

        case 'replaceHTML':
          elements.each((_, el) => {
            $(el).html(change.html);
          });
          break;

        case 'remove':
          elements.remove();
          break;
      }

      this.logger.debug(
        `Applied ${change.type} to ${elements.length} element(s)`,
      );
    }

    return $.html();
  }

  private async htmlToPdf(
    html: string,
  ): Promise<{ filePath: string; fileName: string }> {
    this.logger.log('Launching Puppeteer for PDF rendering...');

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

      const fileName = `edited-${uuidv4()}.pdf`;
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

      this.logger.log(`Edited PDF saved to ${filePath}`);
      return { filePath, fileName };
    } finally {
      await browser.close();
    }
  }
}
