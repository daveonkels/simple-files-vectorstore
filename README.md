# Simple Files Vector Store

A generic solution for creating a vector store from local directories and files, enabling semantic search across their contents. This project is implemented as an MCP (Model Context Protocol) server that provides tools for initializing the store and performing searches.

## Quick Start for Cline
0. Have the path to your directories to watch and index ready, for example `/path/to/your/files`

1. Cone the git repo:

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

The server will automatically index supported files in your watched directories and keep the index updated as files change.

## Supported File Types

- Markdown (.md)
- HTML (.html)
- JSON (.json)
- Plain Text (.txt)

## Features

- Watch multiple directories for supported files
- Convert file contents to embeddings using all-MiniLM-L6-v2 model
- Store embeddings in a FAISS vector store for efficient similarity search
- Configurable text chunking parameters
- Track statistics about indexed files

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

## File Processing

- HTML files: Strips script and style tags, converts to plain text while preserving important content structure
- JSON files: Pretty prints for readability
- Markdown files: Processed as-is since they're already readable
- Text files: Processed as-is

## Implementation Details

- Uses the all-MiniLM-L6-v2 model for generating embeddings
- FAISS vector store for efficient similarity search
- Chunks text using RecursiveCharacterTextSplitter from LangChain
- Tracks metadata including file type, source path, and last modified time
- Supports saving and loading the vector store state

## License

MIT
