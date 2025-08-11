# Code Indexer Architecture

## Purpose

The `code-indexer` package is responsible for:
- **Symbol extraction and indexing** from source code files
- **Persistent storage** of symbol information in SQLite database
- **Cache management** for fast symbol queries
- **Language-agnostic symbol indexing** through provider interfaces

## Core Responsibilities

### What this package DOES:
1. Extract symbols from source code using provided symbol providers
2. Store symbol information in SQLite/memory cache
3. Provide fast symbol queries (by name, kind, location)
4. Track file changes and incremental updates
5. Index external library symbols for better code intelligence

### What this package DOES NOT do:
1. Direct LSP client communication (uses injected providers)
2. MCP server implementation (only provides indexing API)
3. Language-specific parsing (delegates to providers)
4. Tool definitions or user-facing APIs

## Architecture Layers

```
┌─────────────────────────────────────────┐
│         External Consumers              │
│  (MCP Tools, CLI, Testing)             │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         Public API (index.ts)           │
│  - indexFiles()                         │
│  - querySymbols()                       │
│  - getIndexStats()                      │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│       Core Engine (engine/)             │
│  - SymbolIndex: Main orchestrator       │
│  - Types: Core interfaces               │
│  - FileSystem: File operations          │
└─────────────────────────────────────────┘
                    │
           ┌────────┴────────┐
           ▼                 ▼
┌──────────────────┐ ┌──────────────────┐
│  Cache Layer     │ │  Providers       │
│  - SQLiteCache   │ │  - SymbolProvider│
│  - MemoryCache   │ │    (interface)   │
└──────────────────┘ └──────────────────┘
```

## Key Interfaces

### SymbolProvider
```typescript
interface SymbolProvider {
  getDocumentSymbols(uri: string): Promise<DocumentSymbol[]>
}
```
This is the ONLY interface required from external symbol sources.
The provider implementation is injected, not created internally.

### FileSystem
```typescript
interface FileSystem {
  readFile(path: string): Promise<string>
  glob(pattern: string, options?: GlobOptions): Promise<string[]>
  watch(path: string, callback: WatchCallback): Watcher
}
```

### SymbolCache
```typescript
interface SymbolCache {
  get(key: string): Promise<CachedSymbol | null>
  set(key: string, value: CachedSymbol): Promise<void>
  clear(): Promise<void>
}
```

## Migration Plan

### Phase 1: Remove direct LSP dependencies
- [x] Move LSPSymbolProvider to lsp-client package
- [ ] Make SymbolIndex accept provider as constructor param
- [ ] Remove getLSPClient imports

### Phase 2: Remove MCP layer
- [ ] Move IndexerAdapter functionality to src/mcp
- [ ] Make this package pure library without MCP knowledge

### Phase 3: Clean up exports
- [ ] Export only core types and functions
- [ ] Remove legacy stateful APIs
- [ ] Document public API clearly

## Usage Example (After Refactoring)

```typescript
// In MCP layer or CLI
import { SymbolIndex } from '@lsmcp/code-indexer'
import { createLSPSymbolProvider } from '@lsmcp/lsp-client'

// Create provider (MCP/CLI responsibility)
const provider = createLSPSymbolProvider(lspClient)

// Create index with injected provider
const index = new SymbolIndex({
  provider,
  cache: new SQLiteCache(rootPath),
  fileSystem: new NodeFileSystem()
})

// Use index
await index.indexFiles(['**/*.ts'])
const symbols = await index.querySymbols({ name: 'foo' })
```

## Benefits of This Architecture

1. **Separation of Concerns**: Clear boundaries between indexing, LSP, and MCP
2. **Testability**: Easy to mock providers and file systems
3. **Reusability**: Can be used outside of MCP context
4. **Language Agnostic**: Works with any symbol provider
5. **Performance**: Optimized caching and incremental updates