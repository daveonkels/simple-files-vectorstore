import { BaseFileTypeProcessor } from '../types.js';
import { convert, HtmlToTextOptions } from 'html-to-text';
import * as cheerio from 'cheerio';

export class FileTypeProcessorRegistry {
  private processors: BaseFileTypeProcessor[] = [];
  private static instance: FileTypeProcessorRegistry;

  private constructor() {
    // Register default processors
    this.register(new HTMLProcessor());
    this.register(new JSONProcessor());
    this.register(new MarkdownProcessor());
    this.register(new DefaultTextProcessor());
  }

  static getInstance(): FileTypeProcessorRegistry {
    if (!FileTypeProcessorRegistry.instance) {
      FileTypeProcessorRegistry.instance = new FileTypeProcessorRegistry();
    }
    return FileTypeProcessorRegistry.instance;
  }

  register(processor: BaseFileTypeProcessor): void {
    this.processors.push(processor);
    // Sort processors by priority in descending order
    this.processors.sort((a, b) => b.getPriority() - a.getPriority());
  }

  findProcessor(filePath: string): BaseFileTypeProcessor | null {
    return this.processors.find(p => p.canProcess(filePath)) || null;
  }
}

export class HTMLProcessor extends BaseFileTypeProcessor {
  canProcess(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.html');
  }

  getPriority(): number {
    return 1;
  }

  async process(content: string): Promise<string> {
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
}

export class JSONProcessor extends BaseFileTypeProcessor {
  canProcess(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.json');
  }

  getPriority(): number {
    return 1;
  }

  async process(content: string): Promise<string> {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      throw new Error('Invalid JSON content');
    }
  }
}

export class MarkdownProcessor extends BaseFileTypeProcessor {
  canProcess(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.md');
  }

  getPriority(): number {
    return 1;
  }

  async process(content: string): Promise<string> {
    return content;
  }
}

export class DefaultTextProcessor extends BaseFileTypeProcessor {
  canProcess(filePath: string): boolean {
    return true; // Will process any text file
  }

  getPriority(): number {
    return 0; // Lowest priority
  }

  async process(content: string): Promise<string> {
    return content;
  }
}
