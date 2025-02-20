export interface ProcessedDocument {
  content: string;
  metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  source: string;
  fileType: string;
  lastModified: number;
  chunkIndex?: number;
  totalChunks?: number;
}

export interface VectorStoreConfig {
  chunkSize: number;
  chunkOverlap: number;
  watchDirs: string[];
}

export interface SearchResult {
  content: string;
  metadata: DocumentMetadata;
  score?: number;
}

export interface StoreStats {
  totalDocuments: number;
  documentsByType: Record<string, number>;
  watchedDirectories: string[];
  filesBeingProcessed: number;
}

export abstract class BaseFileTypeProcessor {
  abstract canProcess(filePath: string): boolean;
  abstract process(content: string): Promise<string>;
  getPriority(): number {
    return 0;
  }
}
