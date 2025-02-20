# Simple Files Vector Store

A generic solution for creating a vector store from local directories and files, enabling semantic search across their contents. This project is implemented as an MCP (Model Context Protocol) server that provides tools for initializing the store and performing searches.

## Quick Start for Cline
0. Have the path to your directories to watch and index ready, for example `/path/to/your/files`

1. Clone the git repo:

```bash
git clone https://github.com/lishenxydlgzs/simple-files-vectorstore.git && cd simple-files-vectorstore
```

2. Build the server:
```bash
npm install && npm run build
```

3. Add the following to your Cline MCP settings file (`~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "files-vectorstore": {
      "command": "node",
      "args": ["/path/to/simple-files-vectorstore/build/index.js"],
      "env": {
        "WATCH_DIRECTORIES": "/path/to/your/files"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Once configured, Cline will have access to two new tools:

```typescript
// Search your files
use_mcp_tool('files-vectorstore', 'search', {
  query: "What's the architecture of our system?",
  limit: 5
});

// Get indexing statistics
use_mcp_tool('files-vectorstore', 'get_stats', {});
```

The server will automatically index text files in your watched directories and keep the index updated as files change.

## File Type Support

The system can process any text-based file while safely skipping binary files. It includes specialized processors for:

- HTML (.html): Strips script and style tags, converts to plain text while preserving important content structure
- JSON (.json): Pretty prints for readability
- Markdown (.md): Processed as-is since they're already readable
- Other text files: Processed as plain text

Binary files (containing null bytes) are automatically detected and skipped.

### Adding New File Type Processors

The system uses an extensible processor architecture. You can add support for new file types by implementing the `BaseFileTypeProcessor` interface:

```typescript
abstract class BaseFileTypeProcessor {
  abstract canProcess(filePath: string): boolean;
  abstract process(content: string): Promise<string>;
  getPriority(): number { return 0; }
}
```

## Features

- Process any text-based file format
- Safe binary file detection and skipping
- Watch multiple directories for changes
- Convert file contents to embeddings using all-MiniLM-L6-v2 model
- Store embeddings in a FAISS vector store for efficient similarity search
- Configurable text chunking parameters
- Track statistics about indexed files
- Extensible processor architecture for adding new file type support

## Environment Variables

- `WATCH_DIRECTORIES`: Comma-separated list of directories to watch (required)
- `CHUNK_SIZE`: Size of text chunks for processing (default: 1000)
- `CHUNK_OVERLAP`: Overlap between chunks (default: 200)

## Usage

The server exposes the following MCP tools:

### search

Search across indexed files using semantic search.

```typescript
{
  name: 'search',
  arguments: {
    query: string,            // The search query
    limit?: number           // Maximum number of results (default: 5)
  }
}
```

### get_stats

Get statistics about indexed files.

```typescript
{
  name: 'get_stats',
  arguments: {}              // No arguments required
}
```

## Implementation Details

- Uses the all-MiniLM-L6-v2 model for generating embeddings
- FAISS vector store for efficient similarity search
- Chunks text using RecursiveCharacterTextSplitter from LangChain
- Tracks metadata including file type, source path, and last modified time
- Supports saving and loading the vector store state
- Extensible processor architecture for handling different file types
- Safe binary file detection using null byte checking
- UTF-8 text file validation

## License

MIT
