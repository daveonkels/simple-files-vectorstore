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
            },
            required: ['query'],
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
          };
          return this.handleSearch(searchArgs);
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
      // Return whatever results are available
      const results = await this.vectorStore.similaritySearch(
        args.query,
        args.limit || 5
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              results.map((result) => ({
                content: result.content,
                source: result.metadata.source,
                fileType: result.metadata.fileType,
                score: result.score,
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
