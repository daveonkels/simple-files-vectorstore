import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SimpleFilesVectorStore } from '../index.js';
import { FileWatcher } from '../fileWatcher.js';
import { VectorStore } from '../vectorStore.js';
import { FileProcessor } from '../fileProcessor.js';

// Mock the FileProcessor class
vi.mock('../fileProcessor.js', () => ({
  FileProcessor: vi.fn().mockImplementation(() => ({
    processFile: vi.fn().mockResolvedValue([]),
  })),
}));

// Mock the FileWatcher class
vi.mock('../fileWatcher.js', () => ({
  FileWatcher: vi.fn().mockImplementation(() => ({
    initializeIgnorePatterns: vi.fn().mockResolvedValue(undefined),
    setWatchedDirectories: vi.fn(),
    setupDirectoryWatch: vi.fn(),
    processDirectory: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock the VectorStore class
vi.mock('../vectorStore.js', () => ({
  VectorStore: vi.fn().mockImplementation(() => ({
    setWatchedDirectories: vi.fn(),
    incrementProcessingCount: vi.fn(),
    decrementProcessingCount: vi.fn(),
    updateDocuments: vi.fn().mockResolvedValue(undefined),
    removeDocumentsBySource: vi.fn().mockResolvedValue(undefined),
    similaritySearch: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockReturnValue({ totalDocuments: 0, documentsByType: {}, watchedDirectories: [], filesBeingProcessed: 0 }),
  })),
}));

// Mock the fs module
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  access: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ isFile: () => true, isDirectory: () => false }),
}));

// Mock the fs watch function
vi.mock('fs', () => ({
  watch: vi.fn().mockReturnValue({
    close: vi.fn(),
  }),
}));

// Mock the server connection
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    setRequestHandler: vi.fn(),
    onerror: null,
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({
    onmessage: null,
    send: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('Watch Config File', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset process.env
    process.env = { ...originalEnv };
    
    // Clear all mocks
    vi.clearAllMocks();
    
    // Mock console.error to avoid cluttering test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Restore process.env
    process.env = originalEnv;
  });
  
  it('should load directories from WATCH_CONFIG_FILE', async () => {
    // Setup
    const mockConfigPath = '/path/to/config.json';
    const mockWatchList = ['dir1', 'dir2', 'dir3'];
    
    // Mock the readFile function to return our test config
    (fs.readFile as any).mockResolvedValue(JSON.stringify({
      watchList: mockWatchList
    }));
    
    // Set environment variables
    process.env.WATCH_CONFIG_FILE = mockConfigPath;
    
    // Create an instance of SimpleFilesVectorStore
    const server = new SimpleFilesVectorStore();
    
    // Run the server
    await server.run();
    
    // Verify that readFile was called with the correct path
    expect(fs.readFile).toHaveBeenCalledWith(mockConfigPath, 'utf-8');
    
    // Verify that the directories were loaded correctly
    // We can't directly access private properties, but we can check if the console.error was called
    // with the expected message
    expect(console.error).toHaveBeenCalledWith(
      `Loaded watch list from config file: ${mockWatchList.join(', ')}`
    );
  });
  
  it('should throw an error if WATCH_CONFIG_FILE is invalid', async () => {
    // Setup
    const mockConfigPath = '/path/to/invalid-config.json';
    
    // Mock the readFile function to return invalid JSON
    (fs.readFile as any).mockResolvedValue('{ invalid json }');
    
    // Set environment variables
    process.env.WATCH_CONFIG_FILE = mockConfigPath;
    
    // Create an instance of SimpleFilesVectorStore
    const server = new SimpleFilesVectorStore();
    
    // Run the server should throw an error
    await expect(server.run()).rejects.toThrow();
  });
  
  it('should throw an error if watchList is missing or empty', async () => {
    // Setup
    const mockConfigPath = '/path/to/empty-config.json';
    
    // Mock the readFile function to return a config without watchList
    (fs.readFile as any).mockResolvedValue(JSON.stringify({}));
    
    // Set environment variables
    process.env.WATCH_CONFIG_FILE = mockConfigPath;
    
    // Create an instance of SimpleFilesVectorStore
    const server = new SimpleFilesVectorStore();
    
    // Run the server should throw an error
    await expect(server.run()).rejects.toThrow();
  });
  
  it('should prefer WATCH_CONFIG_FILE over WATCH_DIRECTORIES when both are set', async () => {
    // Setup
    const mockConfigPath = '/path/to/config.json';
    const mockWatchList = ['config-dir1', 'config-dir2'];
    const envDirs = 'env-dir1,env-dir2';
    
    // Mock the readFile function to return our test config
    (fs.readFile as any).mockResolvedValue(JSON.stringify({
      watchList: mockWatchList
    }));
    
    // Set environment variables
    process.env.WATCH_CONFIG_FILE = mockConfigPath;
    process.env.WATCH_DIRECTORIES = envDirs;
    
    // Create an instance of SimpleFilesVectorStore
    const server = new SimpleFilesVectorStore();
    
    // Run the server
    await server.run();
    
    // Verify that readFile was called with the correct path
    expect(fs.readFile).toHaveBeenCalledWith(mockConfigPath, 'utf-8');
    
    // Verify that the directories from the config file were used, not from WATCH_DIRECTORIES
    expect(console.error).toHaveBeenCalledWith(
      `Loaded watch list from config file: ${mockWatchList.join(', ')}`
    );
  });
});
