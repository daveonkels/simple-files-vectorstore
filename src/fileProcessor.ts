import { ProcessedDocument, SupportedFileType } from './types.js';
import { convert, HtmlToTextOptions } from 'html-to-text';
import * as cheerio from 'cheerio';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileProcessor {
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor(chunkSize: number = 1000, chunkOverlap: number = 200) {
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });
  }

  private getFileType(filePath: string): SupportedFileType {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.md':
        return 'md';
      case '.html':
        return 'html';
      case '.json':
        return 'json';
      case '.txt':
        return 'txt';
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  private async processHtml(content: string): Promise<string> {
    const $ = cheerio.load(content);

    // Remove script and style tags
    $('script').remove();
    $('style').remove();

    const options: HtmlToTextOptions = {
      wordwrap: false,
      selectors: [
        { selector: 'img', format: 'skip' },
        { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
      ],
    };

    return convert($.html(), options);
  }

  private async processJson(content: string): Promise<string> {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      throw new Error('Invalid JSON content');
    }
  }

  private async processMarkdown(content: string): Promise<string> {
    // For markdown, we'll keep it as is since it's already readable
    return content;
  }

  private async processText(content: string): Promise<string> {
    // For plain text, we'll keep it as is
    return content;
  }

  async processFile(filePath: string): Promise<ProcessedDocument[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const fileType = this.getFileType(filePath);
    const stats = await fs.stat(filePath);

    let processedContent: string;
    switch (fileType) {
      case 'html':
        processedContent = await this.processHtml(content);
        break;
      case 'json':
        processedContent = await this.processJson(content);
        break;
      case 'md':
        processedContent = await this.processMarkdown(content);
        break;
      case 'txt':
        processedContent = await this.processText(content);
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    const chunks = await this.textSplitter.createDocuments(
      [processedContent],
      [{ source: filePath }]
    );

    return chunks.map((chunk: { pageContent: string }, index: number) => ({
      content: chunk.pageContent,
      metadata: {
        source: filePath,
        fileType,
        lastModified: stats.mtimeMs,
        chunkIndex: index,
        totalChunks: chunks.length,
      },
    }));
  }

  async processDirectory(dirPath: string): Promise<ProcessedDocument[]> {
    const documents: ProcessedDocument[] = [];
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      if (item.isDirectory()) {
        const subdirDocs = await this.processDirectory(fullPath);
        documents.push(...subdirDocs);
      } else if (item.isFile()) {
        try {
          const fileType = this.getFileType(fullPath);
          const docs = await this.processFile(fullPath);
          documents.push(...docs);
        } catch (error) {
          // Skip unsupported file types
          if (error instanceof Error && !error.message.startsWith('Unsupported file type')) {
            throw error;
          }
        }
      }
    }

    return documents;
  }
}
