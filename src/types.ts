export type SupportedFileType = 'md' | 'html' | 'json' | 'txt';

export interface ProcessedDocument {
  content: string;
  metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  source: string;
  fileType: SupportedFileType;
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
  documentsByType: Record<SupportedFileType, number>;
  watchedDirectories: string[];
  filesBeingProcessed: number;
}
