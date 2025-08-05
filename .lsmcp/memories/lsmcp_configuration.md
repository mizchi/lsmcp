---
created: 2025-08-05T08:17:00.580Z
updated: 2025-08-05T08:17:00.580Z
---

# lsmcp Configuration Details

## Configuration File: .lsmcp/config.json

### Current Settings
```json
{
  "version": "1.0",
  "indexFiles": ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  "settings": {
    "autoIndex": false,
    "indexConcurrency": 5,
    "autoIndexDelay": 500,
    "enableWatchers": true,
    "memoryLimit": 1024
  },
  "ignorePatterns": ["**/node_modules/**", "**/dist/**", "**/.git/**"],
  "adapter": {
    "id": "tsgo",
    "name": "tsgo",
    "baseLanguage": "typescript",
    "description": "Fast TypeScript language server by tsgo",
    "bin": "npx",
    "args": ["-y", "tsgo", "--lsp", "--stdio"],
    "unsupported": [
      "get_document_symbols",
      "get_workspace_symbols", 
      "get_code_actions",
      "rename_symbol",
      "delete_symbol"
    ],
    "needsDiagnosticDeduplication": true,
    "serverCharacteristics": {
      "documentOpenDelay": 500,
      "readinessCheckTimeout": 200,
      "initialDiagnosticsTimeout": 1000,
      "requiresProjectInit": false,
      "sendsInitialDiagnostics": false,
      "operationTimeout": 5000
    }
  }
}
```

### Key Configuration Options

#### Index Settings
- **indexFiles**: Patterns for files to index (TypeScript/JavaScript files)
- **autoIndex**: Disabled - manual indexing required
- **indexConcurrency**: 5 parallel files during indexing
- **enableWatchers**: File watchers enabled for incremental updates

#### Current LSP Adapter: tsgo
- Fast TypeScript language server
- Limited feature set compared to typescript-language-server
- Does not support: document symbols, workspace symbols, code actions, rename, delete
- Requires diagnostic deduplication
- Has specific timing requirements for document operations

### Symbol Indexing System

The symbol indexing system provides fast symbol search capabilities:

1. **Building the Index**
   - Use `index_files` tool to build symbol index
   - Indexes TypeScript/JavaScript files matching patterns
   - Creates SQLite cache for persistence

2. **Tools Using Pre-built Index** (fast searches)
   - `search_symbol_from_index` - Search by name, kind, file, container
   - `get_index_stats_from_index` - View index statistics
   - `update_index_from_index` - Incremental updates based on git changes
   - `clear_index` - Clear index and caches

3. **Index Benefits**
   - Much faster than file-based searches
   - Supports filtering by symbol kind (Class, Function, etc.)
   - Persistent across sessions via SQLite cache
   - Incremental updates for changed files

### Available Adapters

The project supports multiple language servers via adapters:
- **typescript** - TypeScript Language Server (full features)
- **tsgo** - Fast alternative (current, limited features)
- **deno** - Deno language server
- **pyright** - Python (Microsoft Pyright)
- **ruff** - Python linter as LSP
- **rust-analyzer** - Rust
- **fsharp** - F# (fsautocomplete)
- **moonbit** - MoonBit language
- **gopls** - Go language server

Each adapter has different capabilities - see LSP_SUPPORTED_TABLE.md for details.