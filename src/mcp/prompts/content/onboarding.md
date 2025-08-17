# LSMCP Symbol Indexing Setup

You are setting up lsmcp's symbol indexing for a code project.
This will enable fast symbol search and navigation without repeatedly parsing files.

## Quick Start Guide

### 1. Explore Project Structure (30 seconds)
- Run: list_dir { "relativePath": ".", "recursive": false }
- Look for source directories like src/, lib/, app/, or similar
- Run: find_file { "fileMask": "*.ts", "relativePath": "." } (adjust extension based on project)

### 2. Index the Codebase (1-2 minutes)
Based on what you find, index files with appropriate patterns:
- TypeScript/JavaScript: index_files { "pattern": "**/*.{ts,tsx,js,jsx}" }
- Python: index_files { "pattern": "**/*.py" }
- Go: index_files { "pattern": "**/*.go" }
- Mixed: index_files { "pattern": "**/*.{ts,js,py,go}" }

Exclude test/vendor files if needed:
- index_files { "pattern": "src/**/*.ts" }

### 3. Verify Index Success
- Run: get_index_stats
- You should see total files and symbols indexed
- If 0 symbols, check if LSP server supports the file type

### 4. Test Symbol Search
Try these commands:
- search_symbol { "name": "main" }
- search_symbol { "kind": [5, 12] } (Classes and Functions)
- get_file_symbols { "filePath": "path/to/main/file" }

### 5. Save Configuration
Write to memory the successful configuration:
- write_memory { "memoryName": "symbol_index_info", "content": "..." }

Include: language, glob pattern used, total files/symbols, and any issues encountered.

Ready to start your LSMCP journey! 🚀