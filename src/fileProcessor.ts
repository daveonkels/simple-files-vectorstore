import { ProcessedDocument } from './types.js';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileTypeProcessorRegistry } from './processors/index.js';

export class FileProcessor {
  private textSplitter: RecursiveCharacterTextSplitter;
  private processorRegistry: FileTypeProcessorRegistry;

  constructor(chunkSize: number = 1000, chunkOverlap: number = 200) {
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });
    this.processorRegistry = FileTypeProcessorRegistry.getInstance();
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
      // First check if it's a text file
      if (!await this.isTextFile(filePath)) {
        return [];
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const fileType = this.getFileType(filePath);
      const stats = await fs.stat(filePath);

      // Find appropriate processor
      const processor = this.processorRegistry.findProcessor(filePath);
      if (!processor) {
        return []; // Skip if no processor is found
      }

      const processedContent = await processor.process(content);
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
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw error; // Re-throw file not found errors
      }
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
