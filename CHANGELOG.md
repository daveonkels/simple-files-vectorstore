# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.11] - 2025-01-27

### Added
- **Persistent Vector Storage**: Eliminates re-ingestion on server restart
  - Automatic loading of existing vector store on startup
  - Debounced saving (5-second delay) after document updates
  - Configurable storage location via `VECTOR_STORE_PATH` environment variable
  - Default storage: `~/.simple-files-vectorstore`
- **Performance Optimization**: Dramatically reduces startup time for existing document collections

### Changed
- **Startup Behavior**: Server now loads existing vector data instead of re-processing all files
- **Update Operations**: All document additions/removals now trigger automatic persistence

## [0.1.10] - 2025-01-27

### Added
- **Timestamp Metadata**: Enhanced search results with queryable timestamp information
  - All search results now include `lastModified` (Unix timestamp) and `lastModifiedDate` (ISO string)
  - Enables temporal analysis of document modifications
- **Date-Based Search**: New `search_by_date` MCP tool for temporal queries
  - Filter files by modification date with `after` and `before` parameters
  - Combine date filtering with semantic search using optional `query` parameter
  - Usage: `search_by_date({after: "2024-01-01", query: "documentation"})`
- **Document Retrieval**: New `getAllDocuments` method in VectorStore for non-semantic queries

### Changed
- **Search Response Format**: Enhanced to include timestamp metadata in structured format
- **Tool Collection**: Added `search_by_date` as third MCP tool alongside `search` and `get_stats`

## [0.1.9] - 2025-01-27

### Added
- **Folder-Scoped Search**: New optional `folder` parameter for the search tool
  - Enables searching within specific directories or folder paths
  - Usage: `search({query: "infrastructure", folder: "General"})`
  - Filters results by checking if file source path contains the specified folder string

### Changed
- **Package Configuration**: Updated package name and repository to `@daveonkels/simple-files-vectorstore`
- **Search Interface**: Enhanced `SearchArgs` interface to include optional `folder` parameter
- **Tool Schema**: Updated search tool input schema to document the new folder parameter

## [0.1.8] - 2025-09-02

### Added
- **Enhanced File Processing**: Support for multiple file types beyond plain text
  - Pandoc integration for document conversion (.docx, .odt, .epub, .rtf, .tex, .rst)
  - PDF text extraction using `pdftotext` command
  - OCR support for images using Tesseract (.jpg, .jpeg, .png, .gif, .bmp, .tiff, .webp)
- **Ingestion Logging**: Comprehensive logging system for file processing activities
  - Configurable log path via `INGESTION_LOG_PATH` environment variable
  - Detailed success/failure tracking with timestamps and error messages
  - Logging for both file additions and removals
- **File Type Detection**: Automatic file type detection and appropriate processor selection
- **Error Handling**: Enhanced error handling with specific failure reasons logged

### Changed
- **File Processing Logic**: Completely rewritten `processFile()` method to handle multiple file types
- **Preprocessing Pipeline**: Files now bypass `isTextFile()` check when using specialized processors
- **File Type Assignment**: Processed files get normalized to 'txt' type after successful conversion

## [0.1.7] - 2025-03-31

### Added
- Support for `WATCH_CONFIG_FILE` environment variable to specify a JSON configuration file with a `watchList` array of directories/files to watch
- New `WatchConfig` interface in types.ts to define the structure of the configuration file
- Comprehensive test suite for the new feature in `src/__tests__/watchConfig.test.ts`
- Documentation in README.md for the new feature

### Changed
- Updated error message when no directories are specified to mention both `WATCH_DIRECTORIES` and `WATCH_CONFIG_FILE` options
- Made `WATCH_CONFIG_FILE` and `WATCH_DIRECTORIES` mutually exclusive, with `WATCH_CONFIG_FILE` taking precedence if both are set

## [0.1.6] - Previous version

Initial release with basic functionality.
