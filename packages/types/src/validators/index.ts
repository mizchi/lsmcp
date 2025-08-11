/**
 * Centralized Zod validation schemas for the entire codebase
 */

// Export all validator modules
export * from "./lsp.ts";
export * from "./indexer.ts";
export * from "./config.ts";
export * from "./memory.ts";

// Re-export commonly used schemas at top level for convenience
export {
  commonSchemas,
  lspSchemas,
  fileLocationSchema,
  symbolLocationSchema,
  definitionSchema,
  hoverSchema,
  diagnosticsSchema,
  formattingOptionsSchema,
} from "./lsp.ts";

export {
  SymbolKindSchema,
  // Note: SymbolKind type is already exported from lsp/index.ts
  indexFilesSchema,
  searchSymbolSchema,
  clearIndexSchema,
} from "./indexer.ts";

export {
  configSchema,
  adapterConfigSchema,
  serverCharacteristicsSchema,
  memoryConfigSchema,
  indexConfigSchema,
} from "./config.ts";

export {
  listMemoriesSchema,
  readMemorySchema,
  writeMemorySchema,
  deleteMemorySchema,
  searchMemoriesSchema,
  mergeMemoriesSchema,
  compressMemorySchema,
} from "./memory.ts";
