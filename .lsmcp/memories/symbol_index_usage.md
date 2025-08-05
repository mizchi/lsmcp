---
created: 2025-08-05T08:17:25.940Z
updated: 2025-08-05T08:17:25.940Z
---

# Symbol Index Usage Guide

## Overview
The symbol indexing system in lsmcp provides fast, AI-optimized code navigation and search capabilities. It builds a pre-computed index of all symbols in your codebase for efficient queries.

## Why Use Symbol Indexing?
- **Performance**: 10-100x faster than file-based searches
- **Memory Efficient**: Uses SQLite for persistence
- **Incremental Updates**: Only re-indexes changed files
- **Rich Queries**: Filter by symbol kind, container, file patterns

## Basic Workflow

### 1. Build the Initial Index
```
index_files with pattern "**/*.ts" (or your file pattern)
```
This scans all matching files and builds the symbol index.

### 2. Search Symbols Efficiently
```
search_symbol_from_index with filters:
- name: "MyClass" (supports partial matching)
- kind: "Class" or ["Class", "Interface"]
- file: "src/core/*.ts"
- containerName: "ParentClass"
```

### 3. Keep Index Updated
```
update_index_from_index - Updates only changed files based on git
```

## Symbol Kinds
Use these in the `kind` parameter:
- File, Module, Namespace, Package
- Class, Interface, Struct, Enum
- Method, Function, Constructor
- Property, Field, Variable, Constant
- String, Number, Boolean, Array, Object
- Key, Null, EnumMember, Event, Operator, TypeParameter

## Best Practices

1. **Initial Setup**
   - Run `index_files` when starting work on a project
   - Use appropriate file patterns (e.g., "**/*.ts" for TypeScript)

2. **Searching**
   - Use `search_symbol_from_index` instead of reading entire files
   - Combine filters for precise results
   - Set `includeChildren: false` for top-level symbols only

3. **Maintenance**
   - Run `update_index_from_index` after making changes
   - Use `get_index_stats_from_index` to check index health
   - Clear with `clear_index force:true` if index seems corrupted

4. **Performance Tips**
   - Index only necessary file types
   - Use specific file patterns when possible
   - Leverage containerName for nested symbol searches

## Example Queries

Find all classes in core modules:
```
search_symbol_from_index
  kind: "Class"
  file: "src/core/**/*.ts"
```

Find methods in a specific class:
```
search_symbol_from_index
  kind: "Method"
  containerName: "MyClass"
```

Find all exported functions:
```
search_symbol_from_index
  kind: "Function"
  name: "export"  // Will match exported functions
```

## Limitations with Current Adapter (tsgo)
The current tsgo adapter has limitations:
- Cannot index symbols (returns errors)
- Alternative: Use file-based search tools
- Consider switching to typescript-language-server for full indexing support

## Tools Reference
- `index_files` - Build/rebuild the index
- `search_symbol_from_index` - Fast symbol search
- `get_index_stats_from_index` - View statistics
- `update_index_from_index` - Incremental update
- `clear_index` - Clear index and caches
- `check_index_onboarding` - Check if indexed
- `get_symbol_search_guidance` - Get search tips