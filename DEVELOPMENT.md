# Development Guide

## Quick Setup

1. Clone the repository:
```bash
git clone https://github.com/daveonkels/simple-files-vectorstore.git
cd simple-files-vectorstore
```

2. Install dependencies and build:
```bash
npm install
npm run build
```

3. Configure for your MCP client (see sections below)

## MCP Client Configuration

### Claude Code (VSCode Extension)

Add to your Cline MCP settings file:
`~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

```json
{
  "mcpServers": {
    "files-vectorstore": {
      "command": "node",
      "args": ["/path/to/simple-files-vectorstore/build/index.js"],
      "env": {
        "WATCH_DIRECTORIES": "/path/to/your/directories"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Claude Desktop App

Add to your Claude Desktop configuration file:
`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "files-vectorstore": {
      "command": "npx",
      "args": [
        "/path/to/simple-files-vectorstore/build/index.js"
      ],
      "env": {
        "WATCH_DIRECTORIES": "/path/to/your/directories"
      }
    }
  }
}
```

### Cursor IDE

Add to your Cursor MCP settings file:
`~/Library/Application Support/Cursor/User/globalStorage/anysphere.cursor/settings/cline_mcp_settings.json`

```json
{
  "mcpServers": {
    "files-vectorstore": {
      "command": "node",
      "args": ["/path/to/simple-files-vectorstore/build/index.js"],
      "env": {
        "WATCH_DIRECTORIES": "/path/to/your/directories"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Available Tools

Once configured, you'll have access to these MCP tools:

### 1. search
Perform semantic search across indexed files:
```javascript
// Basic search
search({query: "architecture documentation"})

// Limited results
search({query: "API endpoints", limit: 10})

// Folder-scoped search
search({query: "infrastructure", folder: "docs"})
```

### 2. get_stats
Get indexing statistics:
```javascript
get_stats({})
```

The server automatically indexes files in your watched directories and keeps the index updated as files change.

## Enhanced File Processing

This version supports automatic text extraction from multiple file types:

### Document Formats (via Pandoc)
- Word documents (`.docx`)
- OpenDocument Text (`.odt`)
- EPUB files (`.epub`)
- Rich Text Format (`.rtf`)
- LaTeX documents (`.tex`)
- reStructuredText (`.rst`)

### PDF Documents
- Text extraction using `pdftotext`
- Handles text-based PDFs efficiently

### Images (via OCR)
- JPEG/JPG, PNG, GIF, BMP, TIFF, WebP
- Uses Tesseract OCR for text extraction

### Text Files
- HTML: Strips tags, preserves content structure
- JSON: Pretty printed for readability
- Markdown: Processed as-is
- Plain text: Direct processing

## Configuration Options

### Environment Variables

**Required (choose one):**
- `WATCH_DIRECTORIES`: Comma-separated list of directories
- `WATCH_CONFIG_FILE`: Path to JSON config file with `watchList` array

**Optional:**
- `CHUNK_SIZE`: Text chunk size (default: 1000)
- `CHUNK_OVERLAP`: Chunk overlap (default: 200)
- `IGNORE_FILE`: Path to .gitignore-style file
- `INGESTION_LOG_PATH`: Custom log file path

### Dependencies

For enhanced file processing, install:

```bash
# macOS
brew install pandoc poppler tesseract

# Ubuntu/Debian
sudo apt-get install pandoc poppler-utils tesseract-ocr

# Windows (Chocolatey)
choco install pandoc poppler tesseract
```

## Development

### Testing
```bash
npm test              # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Building
```bash
npm run build         # Build TypeScript
```

### Publishing
```bash
npm run release       # Build and publish
```

## Architecture

The system uses an extensible processor architecture. Add new file type support by implementing `BaseFileTypeProcessor`:

```typescript
abstract class BaseFileTypeProcessor {
  abstract canProcess(filePath: string): boolean;
  abstract process(content: string): Promise<string>;
  getPriority(): number { return 0; }
}
```