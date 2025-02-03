import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { Document } from "@langchain/core/documents";
import { ProcessedDocument, SearchResult, StoreStats, SupportedFileType } from "./types.js";
import { TransformersEmbeddings } from "./embeddings.js";
import * as fs from 'fs/promises';
import * as path from 'path';

export class VectorStore {
  private store: FaissStore | null = null;
  private embeddings: TransformersEmbeddings;
  private stats: StoreStats = {
    totalDocuments: 0,
    documentsByType: {
      md: 0,
      html: 0,
      json: 0,
      txt: 0,
    },
    watchedDirectories: [],
    filesBeingProcessed: 0
  };

  constructor() {
    this.embeddings = new TransformersEmbeddings();
  }

  private documentsBySource: Map<string, Document[]> = new Map();
  private processingFiles: Set<string> = new Set();

  incrementProcessingCount(filePath: string): void {
    this.processingFiles.add(filePath);
    this.stats.filesBeingProcessed = this.processingFiles.size;
  }

  decrementProcessingCount(filePath: string): void {
    this.processingFiles.delete(filePath);
    this.stats.filesBeingProcessed = this.processingFiles.size;
  }

  async addDocuments(docs: ProcessedDocument[]): Promise<void> {
    const documents = docs.map(
      (doc) =>
        new Document({
          pageContent: doc.content,
          metadata: doc.metadata,
        })
    );

    if (!this.store) {
      this.store = await FaissStore.fromDocuments(documents, this.embeddings);
    } else {
      await this.store.addDocuments(documents);
    }

    // Group documents by source
    for (const doc of documents) {
      const source = doc.metadata.source;
      const existing = this.documentsBySource.get(source) || [];
      existing.push(doc);
      this.documentsBySource.set(source, existing);
    }

    // Update stats
    this.stats.totalDocuments += documents.length;
    for (const doc of docs) {
      this.stats.documentsByType[doc.metadata.fileType]++;
    }
  }

  async removeDocumentsBySource(source: string): Promise<void> {
    const documents = this.documentsBySource.get(source);
    if (!documents || !this.store) return;

    // Get IDs of documents to remove
    const ids = await this.store.similaritySearch(
      documents[0].pageContent,
      documents.length,
      (doc: Document) => doc.metadata.source === source
    );
    const docIds = ids.map(doc => doc.id).filter((id): id is string => id !== undefined);
    await this.store.delete({ ids: docIds });

    // Update stats
    this.stats.totalDocuments -= documents.length;
    const fileType = documents[0].metadata.fileType as SupportedFileType;
    this.stats.documentsByType[fileType] -= documents.length;

    // Remove from tracking
    this.documentsBySource.delete(source);
  }

  async updateDocuments(docs: ProcessedDocument[]): Promise<void> {
    if (docs.length === 0) return;

    // Group documents by source
    const docsBySource = new Map<string, ProcessedDocument[]>();
    for (const doc of docs) {
      const source = doc.metadata.source;
      const existing = docsBySource.get(source) || [];
      existing.push(doc);
      docsBySource.set(source, existing);
    }

    // Update each source
    for (const [source, sourceDocs] of docsBySource) {
      // Remove old documents
      await this.removeDocumentsBySource(source);
      // Add new documents
      await this.addDocuments(sourceDocs);
    }
  }

  async similaritySearch(query: string, limit: number = 5): Promise<SearchResult[]> {
    if (!this.store) {
      throw new Error("Vector store not initialized");
    }

    const results = await this.store.similaritySearchWithScore(query, limit);
    return results.map(([doc, score]) => ({
      content: doc.pageContent,
      metadata: doc.metadata as {
        source: string;
        fileType: SupportedFileType;
        lastModified: number;
        chunkIndex: number;
        totalChunks: number;
      },
      score,
    }));
  }

  async save(directory: string): Promise<void> {
    if (!this.store) {
      throw new Error("Vector store not initialized");
    }

    await fs.mkdir(directory, { recursive: true });
    await this.store.save(directory);

    // Save stats
    await fs.writeFile(
      path.join(directory, "stats.json"),
      JSON.stringify(this.stats, null, 2)
    );
  }

  async load(directory: string): Promise<void> {
    try {
      this.store = await FaissStore.load(directory, this.embeddings);
      
      // Load stats
      const statsPath = path.join(directory, "stats.json");
      const statsContent = await fs.readFile(statsPath, "utf-8");
      this.stats = JSON.parse(statsContent);
    } catch (error) {
      throw new Error(`Failed to load vector store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  isInitialized(): boolean {
    return this.store !== null;
  }

  getStats(): StoreStats {
    return { ...this.stats };
  }

  setWatchedDirectories(directories: string[]): void {
    this.stats.watchedDirectories = [...directories];
  }
}
