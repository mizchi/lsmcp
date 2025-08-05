---
created: 2025-08-05T01:35:03.084Z
updated: 2025-08-05T01:35:03.084Z
---

# LSMCP Configuration Details

## Configuration File: .lsmcp/config.json

### Index Settings
- **indexFiles**: `["**/*.rs"]` - Indexes all Rust files
- **autoIndex**: `false` - Manual indexing required
- **indexConcurrency**: `5` - Process 5 files in parallel
- **autoIndexDelay**: `500ms` - Delay before auto-indexing (when enabled)
- **enableWatchers**: `true` - File watchers enabled for updates
- **memoryLimit**: `1024MB` - Memory limit for indexing

### Ignore Patterns
- `**/node_modules/**` - Skip node modules
- `**/dist/**` - Skip distribution files
- `**/.git/**` - Skip git directory

### LSP Adapter Configuration
- **Adapter ID**: `rust-analyzer`
- **Language**: `rust`
- **Binary**: `rust-analyzer` (must be in PATH)
- **Args**: `[]` (no additional arguments)
- **Initialization Options**:
  ```json
  {
    "cargo": {
      "features": "all"
    }
  }
  ```

## Symbol Index System

### How It Works
1. **Building Index**: Use `index_files` with pattern `**/*.rs` to scan and index all Rust files
2. **Storage**: Symbols stored in SQLite cache for persistence
3. **Fast Search**: Tools with `_from_index` suffix query the pre-built index
4. **Updates**: Use `update_index_from_index` for incremental updates based on git changes

### Tools That Use Pre-built Index
- `search_symbol_from_index` - Fast symbol search with filters
- `get_index_stats_from_index` - View index statistics
- `search_cached_symbols_from_index` - Search SQLite cache directly
- `get_cache_stats_from_index` - Cache statistics
- `clear_symbol_cache_from_index` - Clear SQLite cache

### Index Benefits
- Dramatically faster symbol searches across large codebases
- Reduced LSP server load
- Persistent cache survives restarts
- Git-aware incremental updates

### Best Practices
1. Run `index_files` with pattern `**/*.rs` after cloning or major changes
2. Use `update_index_from_index` for incremental updates
3. Prefer `_from_index` tools for symbol searches
4. Clear index with `clear_index` if experiencing issues

## Available LSP Tools
All standard LSP operations are available through rust-analyzer:
- Hover information
- Go to definition
- Find references
- Symbol renaming
- Code completion
- Diagnostics (errors/warnings)
- Code formatting
- Code actions (quick fixes)
- Document symbols
- Workspace symbols