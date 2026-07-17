/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import CloudConvert from 'cloudconvert';
import * as fs from 'fs';

@Injectable()
export class CloudConvertService {
  private readonly logger = new Logger(CloudConvertService.name);
  private cloudConvert: any;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('CLOUDCONVERT_API_KEY') ?? '';
    this.cloudConvert = new CloudConvert(apiKey);
    this.logger.log('CloudConvertService initialized');
  }

  async convertPdfToHtml(filePath: string): Promise<string> {
    this.logger.log(`Converting PDF to HTML via CloudConvert: ${filePath}`);

    // Create a job with import, convert, and export tasks
    const job = await this.cloudConvert.jobs.create({
      tasks: {
        import_task: {
          operation: 'import/base64',
          file: fs.readFileSync(filePath).toString('base64'),
          filename: 'input.pdf',
        },
        convert_task: {
          operation: 'convert',
          input: 'import_task',
          output_format: 'html',
        },
        export_task: {
          operation: 'export/url',
          input: 'convert_task',
        },
      },
    });

    this.logger.log(`Job created: ${job.id}`);

    // Wait for job to complete
    const completedJob = await this.cloudConvert.jobs.wait(job.id);

    const exportTask = completedJob.tasks.find(
      (t: any) => t.name === 'export_task' && t.status === 'finished',
    );

    if (!exportTask?.result?.files?.[0]?.url) {
      throw new Error('CloudConvert export failed - no output file');
    }

    const fileUrl = exportTask.result.files[0].url;
    this.logger.log(`Downloading converted HTML from CloudConvert`);

    const response = await fetch(fileUrl);
    const html = await response.text();

    this.logger.log(`HTML received (${html.length} chars)`);
    return html;
  }
}
