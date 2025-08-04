---
created: 2025-08-04T12:58:13.506Z
updated: 2025-08-04T12:58:13.506Z
---

# LSMCP Configuration

## Config File Location
The project configuration is stored in `.lsmcp/config.json`.

## Config Schema (v1.0)

### Main Fields
- `version`: Config format version (currently "1.0")
- `indexFiles`: Glob patterns for files to index (e.g., ["**/*.ts", "**/*.tsx"])
- `adapter`: LSP adapter configuration (expanded from presets)
- `settings`: Additional settings for indexing and performance
- `ignorePatterns`: Additional patterns to ignore during indexing

### LSP Adapter Configuration
The adapter field contains:
- `id`: Unique identifier (e.g., "typescript", "pyright", "rust-analyzer")
- `name`: Display name
- `bin`: LSP server binary path
- `args`: Command line arguments
- `baseLanguage`: Base language ID
- `serverCharacteristics`: Supported LSP features

### Settings
- `autoIndex`: Automatically index on startup (default: false)
- `indexConcurrency`: Parallel indexing threads (default: 5, range: 1-20)
- `autoIndexDelay`: Delay before auto-indexing (default: 500ms)
- `enableWatchers`: Enable file watchers (default: true)
- `memoryLimit`: Memory limit in MB (default: 1024)

## Initialization
Use `lsmcp init -p <preset>` to initialize with a preset:
- `typescript`: TypeScript/JavaScript projects
- `pyright`: Python projects
- `rust-analyzer`: Rust projects
- `gopls`: Go projects
- `fsharp`: F# projects

## Symbol Indexing
Tools with `_from_index` suffix use pre-built indexes for fast searching:
- `search_symbol_from_index`: Fast symbol search
- `get_index_stats_from_index`: View index statistics
- `update_index_from_index`: Incremental index updates

The index provides ~97% token compression for efficient symbol queries.