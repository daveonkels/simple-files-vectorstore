import { expect, test, describe, beforeEach, vi } from 'vitest';
import { VectorStore } from '../vectorStore.js';
import { ProcessedDocument } from '../types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs.promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
}));

// Mock HNSWLib
vi.mock('@langchain/community/vectorstores/hnswlib', () => ({
  HNSWLib: {
    fromDocuments: vi.fn().mockImplementation(() => ({
      addDocuments: vi.fn(),
      similaritySearchWithScore: vi.fn().mockResolvedValue([
        [{ pageContent: 'result 1', metadata: { source: 'test1.txt', fileType: 'txt', lastModified: 123456789 } }, 0.8],
        [{ pageContent: 'result 2', metadata: { source: 'test2.html', fileType: 'html', lastModified: 123456790 } }, 0.6],
      ]),
      save: vi.fn(),
    })),
    load: vi.fn().mockImplementation(() => ({
      similaritySearchWithScore: vi.fn().mockResolvedValue([
        [{ pageContent: 'result 1', metadata: { source: 'test1.txt', fileType: 'txt', lastModified: 123456789 } }, 0.8],
      ]),
    })),
  },
}));

describe('VectorStore', () => {
  let vectorStore: VectorStore;
  const mockDocuments: ProcessedDocument[] = [
    {
      content: 'test content 1',
      metadata: {
        source: 'test1.txt',
        fileType: 'txt',
        lastModified: 123456789,
        chunkIndex: 0,
        totalChunks: 1,
      },
    },
    {
      content: 'test content 2',
      metadata: {
        source: 'test2.html',
        fileType: 'html',
        lastModified: 123456790,
        chunkIndex: 0,
        totalChunks: 1,
      },
    },
  ];

  beforeEach(() => {
    vectorStore = new VectorStore();
    vi.clearAllMocks();
  });

  describe('document management', () => {
    test('adds documents correctly', async () => {
      await vectorStore.addDocuments(mockDocuments);
      const stats = vectorStore.getStats();
      
      expect(stats.totalDocuments).toBe(2);
      expect(stats.documentsByType['txt']).toBe(1);
      expect(stats.documentsByType['html']).toBe(1);
    });

    test('removes documents by source', async () => {
      await vectorStore.addDocuments(mockDocuments);
      await vectorStore.removeDocumentsBySource('test1.txt');
      const stats = vectorStore.getStats();
      
      expect(stats.totalDocuments).toBe(1);
      expect(stats.documentsByType['txt']).toBeUndefined();
      expect(stats.documentsByType['html']).toBe(1);
    });

    test('updates documents correctly', async () => {
      await vectorStore.addDocuments(mockDocuments);
      
      const updatedDoc: ProcessedDocument = {
        content: 'updated content',
        metadata: {
          source: 'test1.txt',
          fileType: 'txt',
          lastModified: 123456791,
          chunkIndex: 0,
          totalChunks: 1,
        },
      };

      await vectorStore.updateDocuments([updatedDoc]);
      const stats = vectorStore.getStats();
      
      expect(stats.totalDocuments).toBe(2);
      expect(stats.documentsByType['txt']).toBe(1);
    });
  });

  describe('search functionality', () => {
    test('performs similarity search', async () => {
      const mockResults = [
        [{ pageContent: 'result 1', metadata: mockDocuments[0].metadata }, 0.8],
        [{ pageContent: 'result 2', metadata: mockDocuments[1].metadata }, 0.6],
      ];

      await vectorStore.addDocuments(mockDocuments);

      const results = await vectorStore.similaritySearch('test query');
      
      expect(results.length).toBe(2);
      expect(results[0].score).toBe(0.8);
      expect(results[1].score).toBe(0.6);
    });
  });

  describe('persistence', () => {
    test('saves vector store state', async () => {
      await vectorStore.addDocuments(mockDocuments);
      await vectorStore.save('test-dir');
      
      expect(fs.mkdir).toHaveBeenCalledWith('test-dir', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalled();
    });

    test('loads vector store state', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
        totalDocuments: 2,
        documentsByType: { txt: 1, html: 1 },
        watchedDirectories: [],
        filesBeingProcessed: 0,
      }));

      await vectorStore.load('test-dir');
      const stats = vectorStore.getStats();
      
      expect(stats.totalDocuments).toBe(2);
      expect(stats.documentsByType['txt']).toBe(1);
      expect(stats.documentsByType['html']).toBe(1);
    });
  });

  describe('processing tracking', () => {
    test('tracks processing files correctly', () => {
      vectorStore.incrementProcessingCount('test.txt');
      let stats = vectorStore.getStats();
      expect(stats.filesBeingProcessed).toBe(1);

      vectorStore.decrementProcessingCount('test.txt');
      stats = vectorStore.getStats();
      expect(stats.filesBeingProcessed).toBe(0);
    });
  });

  describe('watched directories', () => {
    test('sets watched directories', () => {
      const dirs = ['/path1', '/path2'];
      vectorStore.setWatchedDirectories(dirs);
      const stats = vectorStore.getStats();
      
      expect(stats.watchedDirectories).toEqual(dirs);
    });
  });
});
