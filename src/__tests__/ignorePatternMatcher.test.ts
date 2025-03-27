import { expect, test, describe, beforeEach, afterEach, vi } from 'vitest';
import { IgnorePatternMatcher } from '../ignorePatternMatcher.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs.readFile
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('IgnorePatternMatcher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should ignore .vscode directory', async () => {
    // Mock the readFile to return a pattern that should ignore .vscode
    (fs.readFile as any).mockResolvedValue('.vscode');

    const matcher = new IgnorePatternMatcher('/path/to/ignore/file');
    await matcher.loadPatterns();

    // This should be ignored
    expect(matcher.shouldIgnore('/some/path/.vscode', true)).toBe(true);
    expect(matcher.shouldIgnore('/some/path/.vscode/settings.json', false)).toBe(true);
    
    // These should not be ignored
    expect(matcher.shouldIgnore('/some/path/not-vscode', false)).toBe(false);
    expect(matcher.shouldIgnore('/some/path/folder/file.txt', false)).toBe(false);
  });

  test('should handle multiple patterns', async () => {
    // Mock the readFile to return multiple patterns
    (fs.readFile as any).mockResolvedValue('.vscode\nnode_modules\n*.log');

    const matcher = new IgnorePatternMatcher('/path/to/ignore/file');
    await matcher.loadPatterns();

    // These should be ignored
    expect(matcher.shouldIgnore('/some/path/.vscode', true)).toBe(true);
    expect(matcher.shouldIgnore('/some/path/node_modules', true)).toBe(true);
    expect(matcher.shouldIgnore('/some/path/file.log', false)).toBe(true);
    
    // These should not be ignored
    expect(matcher.shouldIgnore('/some/path/src/index.ts', false)).toBe(false);
    expect(matcher.shouldIgnore('/some/path/file.txt', false)).toBe(false);
  });

  test('should handle nested .vscode directories', async () => {
    // Mock the readFile to return a pattern that should ignore .vscode
    (fs.readFile as any).mockResolvedValue('.vscode');

    const matcher = new IgnorePatternMatcher('/path/to/ignore/file');
    await matcher.loadPatterns();

    // These should be ignored
    expect(matcher.shouldIgnore('/root/.vscode', true)).toBe(true);
    expect(matcher.shouldIgnore('/root/project/.vscode', true)).toBe(true);
    expect(matcher.shouldIgnore('/root/project/subproject/.vscode', true)).toBe(true);
    expect(matcher.shouldIgnore('/root/project/.vscode/launch.json', false)).toBe(true);
  });

  test('should not ignore anything when no patterns are loaded', async () => {
    // Mock the readFile to return an empty string
    (fs.readFile as any).mockResolvedValue('');

    const matcher = new IgnorePatternMatcher('/path/to/ignore/file');
    await matcher.loadPatterns();

    expect(matcher.shouldIgnore('/some/path/.vscode', true)).toBe(false);
    expect(matcher.shouldIgnore('/some/path/file.txt', false)).toBe(false);
  });

  test('should handle errors when loading patterns', async () => {
    // Mock the readFile to throw an error
    (fs.readFile as any).mockRejectedValue(new Error('File not found'));

    const matcher = new IgnorePatternMatcher('/path/to/ignore/file');
    await matcher.loadPatterns();

    // Should not ignore anything when patterns couldn't be loaded
    expect(matcher.shouldIgnore('/some/path/.vscode', true)).toBe(false);
    expect(matcher.shouldIgnore('/some/path/file.txt', false)).toBe(false);
  });
});
