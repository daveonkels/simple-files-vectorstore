# Simple Files Vector Store

A generic solution for creating a vector store from local directories and files, enabling semantic search across their contents. This project is implemented as an MCP (Model Context Protocol) server that provides tools for initializing the store and performing searches.

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

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Build the project:
```bash
npm run build
```

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

## Example Usage

1. Set environment variables:
```bash
export WATCH_DIRECTORIES="/path/to/docs,/path/to/other/files"
export CHUNK_SIZE=1500
export CHUNK_OVERLAP=150
```

2. Search across files:
```typescript
const results = await mcp.use_tool('simple-files-vectorstore', 'search', {
  query: 'How to implement authentication?',
  limit: 10
});
```

3. Get statistics:
```typescript
const stats = await mcp.use_tool('simple-files-vectorstore', 'get_stats', {});
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
