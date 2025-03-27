import * as fs from 'fs/promises';
import * as path from 'path';
import { minimatch } from 'minimatch';

export class IgnorePatternMatcher {
  private patterns: string[] = [];
  private loaded: boolean = false;
  private watchedDirectories: string[] = [];

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

  setWatchedDirectories(directories: string[]): void {
    this.watchedDirectories = directories.map(dir => path.normalize(dir));
  }

  shouldIgnore(filePath: string, isDirectory: boolean = false): boolean {
    if (!this.loaded || this.patterns.length === 0) return false;
    
    const normalizedPath = path.normalize(filePath);
    
    // Check each pattern
    for (const pattern of this.patterns) {
      // For patterns without leading slash, check if any part of the path matches
      if (!pattern.startsWith('/')) {
        // Get the basename or the relevant part for matching
        const basename = path.basename(normalizedPath);
        
        // Direct name match (e.g., ".vscode" matches any file/dir named ".vscode")
        if (basename === pattern) {
          return true;
        }
        
        // Check if any directory in the path matches the pattern
        const pathParts = normalizedPath.split(path.sep);
        for (const part of pathParts) {
          if (part === pattern) {
            return true;
          }
        }
        
        // Check if the path contains the pattern anywhere
        if (normalizedPath.includes(`${path.sep}${pattern}`) || 
            normalizedPath.endsWith(`${path.sep}${pattern}`)) {
          return true;
        }
        
        // For wildcard patterns, use minimatch
        if (pattern.includes('*') || pattern.includes('?') || pattern.includes('[')) {
          // Try to match against the full path
          if (minimatch(normalizedPath, `**/${pattern}`, { dot: true })) {
            return true;
          }
          
          // Try to match against just the basename
          if (minimatch(basename, pattern, { dot: true })) {
            return true;
          }
        }
      } else {
        // For patterns with leading slash, they should match from the root of the watched directories
        const patternWithoutLeadingSlash = pattern.substring(1);
        
        for (const watchedDir of this.watchedDirectories) {
          const fullPattern = path.join(watchedDir, patternWithoutLeadingSlash);
          if (minimatch(normalizedPath, fullPattern, { dot: true })) {
            return true;
          }
        }
      }
      
      // Handle directory-specific patterns (ending with /)
      if (isDirectory && pattern.endsWith('/')) {
        const patternWithoutSlash = pattern.slice(0, -1);
        if (path.basename(normalizedPath) === patternWithoutSlash) {
          return true;
        }
      }
    }
    
    return false;
  }
}
