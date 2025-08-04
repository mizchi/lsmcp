---
created: 2025-08-04T06:35:12.330Z
updated: 2025-08-04T06:35:12.330Z
---

# Symbol Index Usage Guide

The lsmcp project includes a powerful symbol indexing system for fast code analysis.

## Available Tools

### Index Management
- `index_files` - Index files matching a glob pattern
  - Example: `index_files { "pattern": "**/*.ts", "root": "/path/to/project" }`
  
- `get_index_stats` - Get statistics about the index
  - Shows total files, symbols, and indexing time

- `clear_index` - Clear the symbol index
- `update_index` - Update index incrementally (uses git diff)
- `force_clear_index` - Force clear including cache

### Symbol Search
- `search_symbol` - Search symbols with various filters
  - Parameters: name, kind, file, containerName, includeChildren
  - Kind values: File, Module, Namespace, Package, Class, Method, Property, Field, Constructor, Enum, Interface, Function, Variable, Constant, String, Number, Boolean, Array, Object, Key, Null, EnumMember, Struct, Event, Operator, TypeParameter

### Analysis Tools
- `measure_token_compression` - Measure token reduction from symbol indexing
  - Shows how much context can be compressed using symbol summaries

## Usage Example
1. First index the codebase:
   ```
   index_files { "pattern": "**/*.ts", "root": "." }
   ```

2. Search for symbols:
   ```
   search_symbol { "name": "SymbolIndex", "kind": "Class" }
   search_symbol { "containerName": "SymbolIndex", "kind": "Method" }
   ```

3. Check compression ratio:
   ```
   measure_token_compression { "pattern": "src/**/*.ts" }
   ```

## Benefits
- Fast symbol search without parsing files repeatedly
- 97% token compression for LLM context
- Incremental updates based on git changes
- Language-agnostic through LSP integration