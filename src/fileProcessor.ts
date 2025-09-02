import { ProcessedDocument } from './types.js';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { FileTypeProcessorRegistry } from './processors/index.js';

export class FileProcessor {
  private textSplitter: RecursiveCharacterTextSplitter;
  private processorRegistry: FileTypeProcessorRegistry;
  private execAsync: (command: string) => Promise<{ stdout: string; stderr: string }>;
  private pandocExtensions: string[];
  private imageExtensions: string[];
  private pdfExtensions: string[];
  private logPath: string;

  constructor(chunkSize: number = 1000, chunkOverlap: number = 200) {
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });
    this.processorRegistry = FileTypeProcessorRegistry.getInstance();
    this.execAsync = promisify(exec);
    this.pandocExtensions = ['.docx', '.odt', '.epub', '.rtf', '.tex', '.rst'];
    this.imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'];
    this.pdfExtensions = ['.pdf'];
    this.logPath = process.env.INGESTION_LOG_PATH || '/Users/onk/Documents/Vector/.ingestionlog';
  }

  private isPandocEligible(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.pandocExtensions.includes(ext);
  }

  private isImageFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.imageExtensions.includes(ext);
  }

  private isPdfFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.pdfExtensions.includes(ext);
  }

  async logIngestion(filePath: string, action: 'ADD' | 'REMOVE', success: boolean = true, error: string | null = null): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = `${timestamp} | ${action} | ${success ? 'SUCCESS' : 'FAILED'} | ${filePath}${error ? ` | ${error}` : ''}\n`;
      await fs.appendFile(this.logPath, logEntry);
    } catch (logError) {
      console.error('Failed to write ingestion log:', logError);
    }
  }

  private async extractTextFromPdf(filePath: string): Promise<string | null> {
    try {
      const { stdout } = await this.execAsync(`pdftotext "${filePath}" -`);
      return stdout.trim();
    } catch (error) {
      console.error(`PDF text extraction failed for ${filePath}:`, error);
      return null;
    }
  }

  private async extractTextFromImage(filePath: string): Promise<string | null> {
    try {
      const { stdout } = await this.execAsync(`tesseract "${filePath}" stdout`);
      return stdout.trim();
    } catch (error) {
      console.error(`OCR extraction failed for ${filePath}:`, error);
      return null;
    }
  }

  private async convertWithPandoc(filePath: string): Promise<string | null> {
    try {
      const { stdout } = await this.execAsync(`pandoc "${filePath}" -t plain`);
      return stdout;
    } catch (error) {
      console.error(`Pandoc conversion failed for ${filePath}:`, error);
      return null;
    }
  }

  private getFileType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return ext ? ext.slice(1) : 'txt'; // Remove the dot from extension
  }

  private async isTextFile(filePath: string): Promise<boolean> {
    try {
      // Try to read the first few bytes of the file
      const fd = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(4096);
      const { bytesRead } = await fd.read(buffer, 0, 4096, 0);
      await fd.close();

      if (bytesRead === 0) {
        return true; // Empty files are considered text files
      }

      // Check if the buffer contains null bytes (common in binary files)
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) {
          return false;
        }
      }

      // Try decoding as UTF-8
      buffer.slice(0, bytesRead).toString('utf8');
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw error; // Re-throw file not found errors
      }
      return false; // Other errors indicate non-text content
    }
  }

  async processFile(filePath: string): Promise<ProcessedDocument[]> {
    try {
      let content: string | null = null;
      let fileType = this.getFileType(filePath);
      
      // Try pandoc conversion first for eligible files
      if (this.isPandocEligible(filePath)) {
        content = await this.convertWithPandoc(filePath);
        if (content) {
          fileType = 'txt';
        } else {
          await this.logIngestion(filePath, 'ADD', false, 'Pandoc conversion failed');
          return [];
        }
      }
      // Try PDF text extraction
      else if (this.isPdfFile(filePath)) {
        content = await this.extractTextFromPdf(filePath);
        if (content) {
          fileType = 'txt';
        } else {
          await this.logIngestion(filePath, 'ADD', false, 'PDF extraction failed');
          return [];
        }
      }
      // Try OCR for image files
      else if (this.isImageFile(filePath)) {
        content = await this.extractTextFromImage(filePath);
        if (content) {
          fileType = 'txt';
        } else {
          await this.logIngestion(filePath, 'ADD', false, 'OCR extraction failed');
          return [];
        }
      }
      else {
        // Check if it's a text file for non-pandoc/non-image files
        if (!await this.isTextFile(filePath)) {
          await this.logIngestion(filePath, 'ADD', false, 'Not a text file');
          return [];
        }
        content = await fs.readFile(filePath, 'utf-8');
      }

      // At this point, content should not be null
      if (!content) {
        await this.logIngestion(filePath, 'ADD', false, 'No content extracted');
        return [];
      }

      const stats = await fs.stat(filePath);

      // Find appropriate processor
      const processor = this.processorRegistry.findProcessor(filePath);
      if (!processor) {
        await this.logIngestion(filePath, 'ADD', false, 'No processor found');
        return [];
      }

      const processedContent = await processor.process(content);
      const chunks = await this.textSplitter.createDocuments(
        [processedContent],
        [{ source: filePath }]
      );
      
      await this.logIngestion(filePath, 'ADD');
      
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
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw error; // Re-throw file not found errors
      }
      await this.logIngestion(filePath, 'ADD', false, error instanceof Error ? error.message : 'Unknown error');
      console.error(`Error processing file ${filePath}:`, error);
      return [];
    }
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
          const docs = await this.processFile(fullPath);
          documents.push(...docs);
        } catch (error) {
          console.error(`Error processing ${fullPath}:`, error);
        }
      }
    }

    return documents;
  }
}
