/**
 * Facade exports for code indexer package
 * Now re-exporting from local implementations under packages/code-indexer/src
 */

// Core engine
export { SymbolIndex } from "./engine/SymbolIndex.ts";
export type {
  IndexedSymbol,
  FileSymbols,
  SymbolQuery,
  IndexStats,
  SymbolProvider,
  FileSystem,
  SymbolCache,
  IndexEvent,
} from "./engine/types.ts";

// Filesystem adapter
export { NodeFileSystem } from "./engine/NodeFileSystem.ts";

// Cache implementations
export { MemoryCache } from "./cache/MemoryCache.ts";
export { SQLiteCache } from "./cache/SQLiteCache.ts";

// Cache integration helpers
export {
  getSymbolCacheManager,
  cacheSymbolsFromIndex,
  loadCachedSymbols,
  searchSymbolsInCache,
  closeAllCaches,
} from "./cache/symbolCacheIntegration.ts";

// Adapter facade
export {
  getOrCreateIndex,
  clearIndex,
  forceClearIndex,
  indexFiles,
  querySymbols,
  getIndexStats,
  updateIndexIncremental,
} from "./mcp/IndexerAdapter.ts";
export type { IndexerDeps } from "./mcp/IndexerAdapter.ts";

// Engine helpers and config
// Symbol kind utilities are now re-exported from @internal/types
export {
  SYMBOL_KINDS,
  SYMBOL_KIND_NAMES,
  getSymbolKindName,
  parseSymbolKind,
} from "@internal/types";
export { getAdapterDefaultPattern } from "./engine/adapterDefaults.ts";
export {
  shouldExcludeSymbol,
  type IndexConfig,
} from "./config/config.ts";
export { loadIndexConfig } from "./config/configLoader.ts";

// Utilities
export { markFileModified } from "./utils/autoIndex.ts";

/**
 * Indexer facade (stateful; used by some tools and reports)
 */
export {
  getSymbolIndex,
  clearSymbolIndex,
  querySymbols as querySymbolsFromIndex,
  queryExternalLibrarySymbols,
  getTypescriptDependencies,
} from "./symbolIndex.ts";
export type { SymbolIndexState, SymbolEntry } from "./symbolIndex.ts";

// External library indexing (stateful and provider-level)
export { indexExternalLibrariesForState } from "./symbolIndex.ts";
export { indexExternalLibraries } from "./providers/externalLibraryProvider.ts";

// Resolver
export {
  resolveModulePath,
  resolveSymbolFromImports,
  getAvailableExternalSymbols,
  parseImports,
} from "./providers/symbolResolver.ts";
export type { ExternalLibraryConfig } from "./providers/externalLibraryProvider.ts";
