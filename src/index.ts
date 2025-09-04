#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { FileProcessor } from './fileProcessor.js';
import { VectorStore } from './vectorStore.js';
import { FileWatcher } from './fileWatcher.js';
import * as path from 'path';
import * as fs from 'fs/promises';
import { WatchConfig } from './types.js';

interface SearchArgs {
  query: string;
  limit?: number;
  folder?: string;
}

interface SearchByDateArgs {
  after?: string;
  before?: string;
  query?: string;
  limit?: number;
}

export class SimpleFilesVectorStore {
  private server: Server;
  private vectorStore: VectorStore;
  private fileProcessor: FileProcessor;
  private fileWatcher: FileWatcher;
  private defaultDirectories: string[] = [];
  private ignoreFilePath: string | null = null;

  constructor() {
    this.vectorStore = new VectorStore();
    // Get chunk settings from environment variables
    const chunkSize = process.env.CHUNK_SIZE ? parseInt(process.env.CHUNK_SIZE) : 1000;
    const chunkOverlap = process.env.CHUNK_OVERLAP ? parseInt(process.env.CHUNK_OVERLAP) : 200;
    this.fileProcessor = new FileProcessor(chunkSize, chunkOverlap);

    // Get ignore file path from environment variable
    this.ignoreFilePath = process.env.IGNORE_FILE || null;
    if (this.ignoreFilePath) {
      console.error(`Using ignore file: ${this.ignoreFilePath}`);
    }

    // Check for watch config file or directories in environment variables
    const watchConfigFile = process.env.WATCH_CONFIG_FILE;
    const envDirs = process.env.WATCH_DIRECTORIES;
    
    if (watchConfigFile && envDirs) {
      console.error('Both WATCH_CONFIG_FILE and WATCH_DIRECTORIES are set. Using WATCH_CONFIG_FILE.');
    }
    
    if (watchConfigFile) {
      console.error(`Using watch config file: ${watchConfigFile}`);
      // The actual loading of the config file will happen in the run method
      // to allow for proper async handling and error management
    } else if (envDirs) {
      this.defaultDirectories = envDirs.split(',').map(dir => dir.trim());
      console.error(`Loaded default directories from WATCH_DIRECTORIES: ${this.defaultDirectories.join(', ')}`);
    }

    // Initialize file watcher with ignore file path
    this.fileWatcher = new FileWatcher(
      this.fileProcessor,
      this.handleFileChange.bind(this),
      this.ignoreFilePath
    );

    this.server = new Server({
      name: 'simple-files-vectorstore',
      version: '0.1.0',
    });

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.fileWatcher.close();
      await this.server.close();
      process.exit(0);
    });
  }

  private async handleFileChange(type: 'add' | 'change' | 'unlink', filePath: string): Promise<void> {
    try {
      if (type === 'unlink') {
        await this.vectorStore.removeDocumentsBySource(filePath);
        await this.fileProcessor.logIngestion(filePath, 'REMOVE');
      } else {
        this.vectorStore.incrementProcessingCount(filePath);
        try {
          const documents = await this.fileProcessor.processFile(filePath);
          await this.vectorStore.updateDocuments(documents);
        } finally {
          this.vectorStore.decrementProcessingCount(filePath);
        }
      }
    } catch (error) {
      // Skip unsupported files
      if (error instanceof Error && !error.message.startsWith('Unsupported file type')) {
        console.error(`Error processing file ${filePath}:`, error);
      }
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search',
          description: 'Search local files using semantic search.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 5)',
                minimum: 1,
                maximum: 20,
              },
              folder: {
                type: 'string',
                description: 'Optional folder path to limit search scope',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'search_by_date',
          description: 'Search files by modification date with optional semantic search.',
          inputSchema: {
            type: 'object',
            properties: {
              after: {
                type: 'string',
                description: 'ISO date string - files modified after this date (e.g., "2024-01-01")',
              },
              before: {
                type: 'string',
                description: 'ISO date string - files modified before this date (e.g., "2024-12-31")',
              },
              query: {
                type: 'string',
                description: 'Optional search query to combine with date filtering',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 5)',
                minimum: 1,
                maximum: 20,
              },
            },
            required: [],
          },
        },
        {
          name: 'get_stats',
          description: 'Get statistics about indexed files',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'search':
          if (!request.params.arguments || !('query' in request.params.arguments) || typeof request.params.arguments.query !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid query parameter');
          }
          const searchArgs: SearchArgs = {
            query: request.params.arguments.query,
            limit: typeof request.params.arguments.limit === 'number' ? request.params.arguments.limit : undefined,
            folder: typeof request.params.arguments.folder === 'string' ? request.params.arguments.folder : undefined,
          };
          return this.handleSearch(searchArgs);
        case 'search_by_date':
          const searchByDateArgs: SearchByDateArgs = {
            after: typeof request.params.arguments?.after === 'string' ? request.params.arguments.after : undefined,
            before: typeof request.params.arguments?.before === 'string' ? request.params.arguments.before : undefined,
            query: typeof request.params.arguments?.query === 'string' ? request.params.arguments.query : undefined,
            limit: typeof request.params.arguments?.limit === 'number' ? request.params.arguments.limit : undefined,
          };
          return this.handleSearchByDate(searchByDateArgs);
        case 'get_stats':
          return this.handleGetStats();
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async handleSearch(args: SearchArgs) {
    try {
      // Get initial results
      const results = await this.vectorStore.similaritySearch(
        args.query,
        args.limit || 5
      );

      // Filter by folder if specified
      const filteredResults = args.folder 
        ? results.filter(result => result.metadata.source.includes(args.folder!))
        : results;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              filteredResults.map((result) => ({
                content: result.content,
                source: result.metadata.source,
                fileType: result.metadata.fileType,
                score: result.score,
                lastModified: result.metadata.lastModified,
                lastModifiedDate: new Date(result.metadata.lastModified).toISOString(),
              })),
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async handleSearchByDate(args: SearchByDateArgs) {
    try {
      // Parse date filters
      const afterTimestamp = args.after ? new Date(args.after).getTime() : null;
      const beforeTimestamp = args.before ? new Date(args.before).getTime() : null;

      // Validate dates
      if (args.after && isNaN(afterTimestamp!)) {
        throw new McpError(ErrorCode.InvalidParams, `Invalid 'after' date: ${args.after}`);
      }
      if (args.before && isNaN(beforeTimestamp!)) {
        throw new McpError(ErrorCode.InvalidParams, `Invalid 'before' date: ${args.before}`);
      }

      // Get results (with or without semantic search)
      const results = args.query 
        ? await this.vectorStore.similaritySearch(args.query, args.limit || 20)
        : await this.vectorStore.getAllDocuments(args.limit || 20);

      // Filter by date
      const filteredResults = results.filter(result => {
        const fileTimestamp = result.metadata.lastModified;
        if (afterTimestamp && fileTimestamp <= afterTimestamp) return false;
        if (beforeTimestamp && fileTimestamp >= beforeTimestamp) return false;
        return true;
      });

      // Limit results
      const limitedResults = filteredResults.slice(0, args.limit || 5);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              limitedResults.map((result) => ({
                content: result.content,
                source: result.metadata.source,
                fileType: result.metadata.fileType,
                score: result.score,
                lastModified: result.metadata.lastModified,
                lastModifiedDate: new Date(result.metadata.lastModified).toISOString(),
              })),
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) throw error;
      throw new McpError(
        ErrorCode.InternalError,
        `Date search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async handleGetStats() {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(this.vectorStore.getStats(), null, 2),
        },
      ],
    };
  }

  private async loadWatchConfigFile(configFilePath: string): Promise<string[]> {
    try {
      const configContent = await fs.readFile(configFilePath, 'utf-8');
      const config = JSON.parse(configContent) as WatchConfig;
      
      if (!config.watchList || !Array.isArray(config.watchList) || config.watchList.length === 0) {
        throw new Error(`Invalid watch config file: ${configFilePath}. The 'watchList' field must be a non-empty array of strings.`);
      }
      
      return config.watchList;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load watch config file: ${error.message}`);
      }
      throw error;
    }
  }

  async run() {
    try {
      // Check if we need to load directories from config file
      const watchConfigFile = process.env.WATCH_CONFIG_FILE;
      if (watchConfigFile) {
        try {
          const watchList = await this.loadWatchConfigFile(watchConfigFile);
          this.defaultDirectories = watchList;
          console.error(`Loaded watch list from config file: ${watchList.join(', ')}`);
        } catch (error) {
          console.error(error);
          throw new Error(`Failed to load watch config file. ${error instanceof Error ? error.message : ''}`);
        }
      }
      
      // Validate directories
      if (this.defaultDirectories.length === 0) {
        throw new Error('No directories specified. Set either WATCH_DIRECTORIES environment variable or provide a WATCH_CONFIG_FILE.');
      }

      // Initialize ignore patterns
      await this.fileWatcher.initializeIgnorePatterns();

      // Set watched directories for ignore pattern matching
      this.fileWatcher.setWatchedDirectories(this.defaultDirectories);

      // Set up watchers first (non-blocking)
      for (const dir of this.defaultDirectories) {
        this.fileWatcher.setupDirectoryWatch(dir);
      }
      this.vectorStore.setWatchedDirectories(this.defaultDirectories);

      // Start server immediately
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('Simple Files Vector Store MCP server running on stdio');

      // Start processing existing files in the background
      for (const dir of this.defaultDirectories) {
        this.fileWatcher.processDirectory(dir).catch(error => {
          console.error(`Error processing directory ${dir}:`, error);
        });
      }
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  }
}

const server = new SimpleFilesVectorStore();
server.run().catch(console.error);
