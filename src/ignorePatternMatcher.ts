import * as fs from 'fs/promises';
import * as path from 'path';
import { minimatch } from 'minimatch';

export class IgnorePatternMatcher {
  private patterns: string[] = [];
  private loaded: boolean = false;

  constructor(private ignoreFilePath: string | null) {}

  async loadPatterns(): Promise<void> {
    if (this.loaded || !this.ignoreFilePath) return;
    
    try {
      const content = await fs.readFile(this.ignoreFilePath, 'utf-8');
      this.patterns = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      this.loaded = true;
    } catch (error) {
      console.error(`Error loading ignore file ${this.ignoreFilePath}:`, error);
      // Continue without patterns if file can't be loaded
      this.patterns = [];
      this.loaded = true;
    }
  }

  shouldIgnore(filePath: string, isDirectory: boolean = false): boolean {
    if (!this.loaded || this.patterns.length === 0) return false;
    
    const relativePath = path.normalize(filePath);
    
    for (const pattern of this.patterns) {
      if (minimatch(relativePath, pattern, { dot: true })) {
        return true;
      }
      
      // Handle directory-specific patterns (ending with /)
      if (isDirectory && pattern.endsWith('/') && 
          minimatch(relativePath, pattern.slice(0, -1), { dot: true })) {
        return true;
      }
    }
    
    return false;
  }
}
