# @daveonkels/simple-files-vectorstore

_Forked from @lishenxydlgzs_

A Model Context Protocol (MCP) server that provides semantic search capabilities across files. This server watches specified directories and creates vector embeddings of file contents, enabling semantic search across your documents.

**Enhanced Version** - This fork includes additional file processing capabilities for documents, PDFs, and images.

## Installation & Usage
Add to your MCP settings file:
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
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

MCP settings file locations:
- VSCode Cline Extension: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- Claude Desktop App: `~/Library/Application Support/Claude/claude_desktop_config.json`

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
- Text extraction from PDFs using `pdftotext`
- Handles text-based PDFs efficiently

### Images (via OCR)
- JPEG/JPG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- GIF (`.gif`)
- BMP (`.bmp`)
- TIFF (`.tiff`)
- WebP (`.webp`)

### Processing Order
1. **Document files** → Convert with Pandoc
2. **PDF files** → Extract text with pdftotext
3. **Image files** → Extract text with Tesseract OCR
4. **Text files** → Process directly (original behavior)

## Dependencies

To use the enhanced file processing features, install these dependencies:

```bash
# macOS
brew install pandoc      # Document conversion
brew install poppler     # PDF text extraction (pdftotext)
brew install tesseract   # Image OCR

# Ubuntu/Debian
sudo apt-get install pandoc poppler-utils tesseract-ocr

# Windows (via Chocolatey)
choco install pandoc poppler tesseract
```

## Configuration

The server requires configuration through environment variables:

### Required Environment Variables

You must specify directories to watch using ONE of the following methods:

- `WATCH_DIRECTORIES`: Comma-separated list of directories to watch
- `WATCH_CONFIG_FILE`: Path to a JSON configuration file with a `watchList` array

Example using WATCH_DIRECTORIES:
```json
{
  "mcpServers": {
    "files-vectorstore": {
      "command": "npx",
      "args": [
        "/path/to/simple-files-vectorstore/build/index.js"
      ],
      "env": {
        "WATCH_DIRECTORIES": "/path/to/dir1,/path/to/dir2"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Optional Environment Variables

- `CHUNK_SIZE`: Size of text chunks for processing (default: 1000)
- `CHUNK_OVERLAP`: Overlap between chunks (default: 200)
- `IGNORE_FILE`: Path to a .gitignore style file to exclude files/directories based on patterns
- `INGESTION_LOG_PATH`: Path to ingestion log file (default: `/Users/onk/Documents/Vector/.ingestionlog`)

Example with all optional parameters:

```json
{
  "mcpServers": {
    "files-vectorstore": {
      "command": "npx",
      "args": [
        "/path/to/simple-files-vectorstore/build/index.js"
      ],
      "env": {
        "WATCH_DIRECTORIES": "/path/to/dir1,/path/to/dir2",
        "CHUNK_SIZE": "2000",
        "CHUNK_OVERLAP": "500",
        "IGNORE_FILE": "/path/to/.gitignore",
        "INGESTION_LOG_PATH": "/custom/path/to/ingestion.log"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Ingestion Logging

The server maintains a detailed log of all file processing activities:

### Log Format
```
2025-09-01T23:47:00.000Z | ADD | SUCCESS | /path/to/file.pdf
2025-09-01T23:47:05.000Z | ADD | FAILED | /path/to/image.jpg | OCR extraction failed
2025-09-01T23:47:10.000Z | REMOVE | SUCCESS | /path/to/deleted.txt
```

### Log Entry Types
- **ADD SUCCESS**: File successfully processed and indexed
- **ADD FAILED**: File processing failed (with reason)
- **REMOVE SUCCESS**: File successfully removed from index

Common failure reasons:
- `Pandoc conversion failed`
- `PDF extraction failed`
- `OCR extraction failed`
- `Not a text file`
- `No processor found`

## MCP Tools

This server provides the following MCP tools:

### 1. search

Perform semantic search across indexed files.

Parameters:
- `query` (required): The search query string
- `limit` (optional): Maximum number of results to return (default: 5, max: 20)
- `folder` (optional): Folder path to limit search scope

Example usage:
```javascript
// Search all files
search({query: "infrastructure documentation"})

// Search within specific folder
search({query: "One Medical infrastructure", folder: "General"})
```

Example response:
```json
[
  {
    "content": "matched text content",
    "source": "/path/to/file",
    "fileType": "txt",
    "score": 0.85
  }
]
```

### 2. get_stats

Get statistics about indexed files.

Parameters: None

Example response:
```json
{
  "totalDocuments": 42,
  "watchedDirectories": ["/path/to/docs"],
  "processingFiles": []
}
```

## Features

- **Enhanced file support**: Documents, PDFs, and images via OCR
- **Real-time file watching** and indexing
- **Semantic search** using vector embeddings
- **Folder-scoped search**: Limit searches to specific directories
- **Comprehensive logging** of all ingestion activities
- **Configurable processing** with environment variables
- **Background processing** of files
- **Automatic handling** of file changes and deletions
- **Flexible configuration** via environment variables

## Building from Source

```bash
npm install
npm run build
```

The built files will be in the `build/` directory.

## Repository

[Original Repository](https://github.com/lishenxydlgzs/simple-files-vectorstore)
