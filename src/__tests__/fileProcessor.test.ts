import { expect, test, describe, beforeEach, vi } from 'vitest';
import { FileProcessor } from '../fileProcessor.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs.promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
  open: vi.fn(),
  readdir: vi.fn(),
}));

// Mock RecursiveCharacterTextSplitter
vi.mock('@langchain/textsplitters', () => ({
  RecursiveCharacterTextSplitter: class {
    constructor() {}
    createDocuments(texts: string[], metadata: any[]) {
      return texts.map(text => ({
        pageContent: text,
        metadata: metadata[0]
      }));
    }
  }
}));

describe('FileProcessor', () => {
  let processor: FileProcessor;
  const mockStat = { mtimeMs: 123456789 };

  beforeEach(() => {
    processor = new FileProcessor();
    vi.clearAllMocks();
  });

  describe('isTextFile detection', () => {
    beforeEach(() => {
      vi.mocked(fs.stat).mockResolvedValue({ mtimeMs: 123456789 } as any);
      vi.mocked(fs.readFile).mockResolvedValue('test content');
    });

    test('identifies text files correctly', async () => {
      const textBuffer = Buffer.from('text content');
      const mockFd = {
        read: vi.fn().mockImplementation((buffer, offset, length, position) => {
          textBuffer.copy(buffer);
          return Promise.resolve({
            bytesRead: textBuffer.length,
            buffer
          });
        }),
        close: vi.fn(),
      };
      vi.mocked(fs.open).mockResolvedValue(mockFd as any);
      vi.mocked(fs.readFile).mockResolvedValue('test content');

      const docs = await processor.processFile('test.txt');
      expect(docs.length).toBeGreaterThan(0);
      expect(docs[0].content).toBe('test content');
    });

    test('identifies binary files correctly', async () => {
      const binaryBuffer = Buffer.from([0, 1, 2, 0, 4, 5]); // Contains null bytes
      const mockFd = {
        read: vi.fn().mockImplementation((buffer, offset, length, position) => {
          binaryBuffer.copy(buffer);
          return Promise.resolve({
            bytesRead: binaryBuffer.length,
            buffer
          });
        }),
        close: vi.fn(),
      };
      vi.mocked(fs.open).mockResolvedValue(mockFd as any);

      const docs = await processor.processFile('test.bin');
      expect(docs).toEqual([]);
    });
  });

  describe('file type processing', () => {
    beforeEach(() => {
      vi.mocked(fs.stat).mockResolvedValue(mockStat as any);
      // Mock text file detection for all file type tests
      const textBuffer = Buffer.from('text content');
      const mockFd = {
        read: vi.fn().mockImplementation((buffer, offset, length, position) => {
          textBuffer.copy(buffer);
          return Promise.resolve({
            bytesRead: textBuffer.length,
            buffer
          });
        }),
        close: vi.fn(),
      };
      vi.mocked(fs.open).mockResolvedValue(mockFd as any);
    });

    test('processes HTML files correctly', async () => {
      const htmlContent = '<html><body><h1>Test</h1></body></html>';
      vi.mocked(fs.readFile).mockResolvedValue(htmlContent);

      const docs = await processor.processFile('test.html');
      
      expect(docs.length).toBeGreaterThan(0);
      expect(docs[0].content.toLowerCase()).toContain('test');
      expect(docs[0].metadata.fileType).toBe('html');
    });

    test('processes JSON files correctly', async () => {
      const jsonContent = JSON.stringify({ test: 'value' });
      vi.mocked(fs.readFile).mockResolvedValue(jsonContent);

      const docs = await processor.processFile('test.json');
      
      expect(docs.length).toBeGreaterThan(0);
      expect(docs[0].content).toContain('test');
      expect(docs[0].content).toContain('value');
      expect(docs[0].metadata.fileType).toBe('json');
    });

    test('processes Markdown files correctly', async () => {
      const mdContent = '# Title\n\nContent';
      vi.mocked(fs.readFile).mockResolvedValue(mdContent);

      const docs = await processor.processFile('test.md');
      
      expect(docs.length).toBeGreaterThan(0);
      expect(docs[0].content).toBe(mdContent);
      expect(docs[0].metadata.fileType).toBe('md');
    });

    test('processes unknown text files with default processor', async () => {
      const textContent = 'Simple text content';
      vi.mocked(fs.readFile).mockResolvedValue(textContent);

      const docs = await processor.processFile('test.unknown');
      
      expect(docs.length).toBeGreaterThan(0);
      expect(docs[0].content).toBe(textContent);
      expect(docs[0].metadata.fileType).toBe('unknown');
    });
  });

  describe('directory processing', () => {
    beforeEach(() => {
      // Mock text file detection for directory processing
      const textBuffer = Buffer.from('text content');
      const mockFd = {
        read: vi.fn().mockImplementation((buffer, offset, length, position) => {
          textBuffer.copy(buffer);
          return Promise.resolve({
            bytesRead: textBuffer.length,
            buffer
          });
        }),
        close: vi.fn(),
      };
      vi.mocked(fs.open).mockResolvedValue(mockFd as any);
    });

    test('processes directory recursively', async () => {
      const mockFiles = [
        { name: 'test.txt', isDirectory: () => false, isFile: () => true },
        { name: 'test.html', isDirectory: () => false, isFile: () => true },
        { name: 'subdir', isDirectory: () => true, isFile: () => false },
      ];
      const mockSubdirFiles = [
        { name: 'test.md', isDirectory: () => false, isFile: () => true },
      ];

      vi.mocked(fs.readdir)
        .mockResolvedValueOnce(mockFiles as any)
        .mockResolvedValueOnce(mockSubdirFiles as any);

      vi.mocked(fs.readFile).mockResolvedValue('test content');
      vi.mocked(fs.stat).mockResolvedValue(mockStat as any);

      const docs = await processor.processDirectory('testdir');
      
      expect(docs.length).toBeGreaterThan(0);
      expect(vi.mocked(fs.readdir)).toHaveBeenCalledTimes(2);
    });
  });
});
