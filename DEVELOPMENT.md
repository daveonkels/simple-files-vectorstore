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