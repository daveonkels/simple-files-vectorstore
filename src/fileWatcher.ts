import * as fs from 'fs/promises';
import { watch, FSWatcher } from 'fs';
import * as path from 'path';
import { FileProcessor } from './fileProcessor.js';
import { ProcessedDocument } from './types.js';
import { IgnorePatternMatcher } from './ignorePatternMatcher.js';

type FileChangeCallback = (type: 'add' | 'change' | 'unlink', filePath: string) => Promise<void>;

export class FileWatcher {
  private watchers: Map<string, FSWatcher> = new Map();
  private fileProcessor: FileProcessor;
  private processedPaths: Set<string> = new Set();
  private processingQueue: Set<string> = new Set();
  private onFileChange: FileChangeCallback;
  private ignorePatternMatcher: IgnorePatternMatcher;

  constructor(
    fileProcessor: FileProcessor,
    onFileChange: FileChangeCallback,
    ignoreFilePath: string | null = null
  ) {
    this.fileProcessor = fileProcessor;
    this.onFileChange = onFileChange;
    this.ignorePatternMatcher = new IgnorePatternMatcher(ignoreFilePath);
  }

  async initializeIgnorePatterns(): Promise<void> {
    await this.ignorePatternMatcher.loadPatterns();
  }

  setWatchedDirectories(directories: string[]): void {
    this.ignorePatternMatcher.setWatchedDirectories(directories);
  }

  setupDirectoryWatch(dirPath: string): void {
    // Set up watchers without waiting for file processing
    this.setupWatcher(dirPath);
  }

  async processDirectory(dirPath: string): Promise<void> {
    // Process existing files in the background
    await this.processExistingFiles(dirPath);
  }

  async watchDirectory(dirPath: string): Promise<void> {
    // For backwards compatibility and cases where blocking is desired
    this.setupDirectoryWatch(dirPath);
    await this.processDirectory(dirPath);
  }

  private async processExistingFiles(dirPath: string): Promise<void> {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      
      // Check if the item should be ignored
      if (this.ignorePatternMatcher.shouldIgnore(fullPath, item.isDirectory())) {
        continue;
      }
      
      if (item.isDirectory()) {
        await this.processExistingFiles(fullPath);
      } else if (item.isFile()) {
        try {
          await this.handleFileChange('add', fullPath);
        } catch (error) {
          // Skip unsupported files
          if (error instanceof Error && !error.message.startsWith('Unsupported file type')) {
            console.error(`Error processing file ${fullPath}:`, error);
          }
        }
      }
    }
  }

  private setupWatcher(dirPath: string): void {
    // Recursively watch the directory
    const watcher = watch(
      dirPath,
      { recursive: true },
      async (eventType, filename) => {
        if (!filename) return;

          const fullPath = path.join(dirPath, filename);

          try {
            // Check if the file exists to determine if it was deleted
            const exists = await fs.access(fullPath).then(() => true).catch(() => false);
            
            if (!exists) {
              await this.handleFileChange('unlink', fullPath);
            } else {
              const stats = await fs.stat(fullPath);
              
              // Check if the file should be ignored
              if (this.ignorePatternMatcher.shouldIgnore(fullPath, stats.isDirectory())) {
                return;
              }
              
              if (stats.isFile()) {
              await this.handleFileChange(eventType === 'rename' ? 'add' : 'change', fullPath);
            }
          }
        } catch (error) {
          console.error(`Error handling file change for ${fullPath}:`, error);
        }
      }
    );

    this.watchers.set(dirPath, watcher);
  }

  private async handleFileChange(type: 'add' | 'change' | 'unlink', filePath: string): Promise<void> {
    // Skip if file is already being processed
    if (this.processingQueue.has(filePath)) {
      return;
    }

    try {
      // Add to processing queue
      this.processingQueue.add(filePath);

      // Notify callback
      await this.onFileChange(type, filePath);

      // Update processed paths
      if (type === 'unlink') {
        this.processedPaths.delete(filePath);
      } else {
        this.processedPaths.add(filePath);
      }
    } finally {
      // Remove from processing queue
      this.processingQueue.delete(filePath);
    }
  }

  isProcessing(filePath: string): boolean {
    return this.processingQueue.has(filePath);
  }

  async close(): Promise<void> {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    this.processedPaths.clear();
    this.processingQueue.clear();
  }
}
