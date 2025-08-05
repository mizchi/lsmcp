---
created: 2025-08-05T01:47:05.262Z
updated: 2025-08-05T01:47:05.262Z
---

# LSMCP Configuration

## Configuration File: .lsmcp/config.json

```json
{
  "version": "1.0",
  "indexFiles": ["**/*.mbt"],
  "settings": {
    "autoIndex": false,
    "indexConcurrency": 5,
    "autoIndexDelay": 500,
    "enableWatchers": true,
    "memoryLimit": 1024
  },
  "ignorePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/.git/**"
  ],
  "adapter": {
    "id": "moonbit",
    "name": "MoonBit Language Server",
    "baseLanguage": "moonbit",
    "description": "moonbit lsp",
    "bin": "moonbit-lsp",
    "args": [],
    "unsupported": []
  }
}
```

## Key Settings
- **indexFiles**: Patterns for files to index (all .mbt files)
- **autoIndex**: Disabled - manual indexing required
- **indexConcurrency**: 5 files indexed in parallel
- **enableWatchers**: File watchers are enabled
- **memoryLimit**: 1024MB memory limit

## LSP Adapter
- Uses `moonbit-lsp` as the language server
- Configured for Moonbit language support
- No unsupported features listed

## MCP Server Configuration: .mcp.json
```json
{
  "mcpServers": {
    "moonbit": {
      "command": "node",
      "args": ["../../dist/lsmcp.js", "-p", "moonbit"]
    }
  }
}
```

## Symbol Indexing
Tools that benefit from pre-built indexes (use after running `index_files`):
- `search_symbol_from_index` - Fast symbol search
- `get_index_stats_from_index` - View index statistics
- `update_index_from_index` - Incremental index updates

Always index .mbt files first for optimal performance when searching symbols.