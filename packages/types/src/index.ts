// Main entry point for @lsmcp/types package

// LSP types
export * from "./lsp/index.ts";

// Re-export specific type aliases that might not be picked up by export *
export type { Definition, SignatureHelp } from "./lsp/index.ts";

// Domain types
export * from "./domain/index.ts";

// Common types
export * from "./common/logger.ts";

// Shared utilities (except schemas which are now in validators)
export {
  // Error utilities
  getErrorMessage,
  isErrorWithCode,
  formatError,
  LSMCPError,
  LSPClientError,
  FileSystemError,
  IndexingError,
  ValidationError,
  TimeoutError,
  // Result utilities
  Ok,
  Err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  map,
  mapErr,
  tryAsync,
  trySync,
  // Type guards and utilities
  isObject,
  isString,
  isNumber,
  isBoolean,
  isArray,
  isFunction,
  isDefined,
  isNotNull,
  isNotNullish,
  sleep,
  debounce,
  throttle,
  memoize,
} from "./shared/index.ts";

// Constants
export * from "./constants/config.ts";
export * from "./constants/diagnostics.ts";
export * from "./constants/indexer.ts";
export * from "./constants/lsp.ts";

// Validators (Zod schemas) - but avoid conflicts
export {
  // LSP schemas
  lspSchemas,
  commonSchemas,
  fileLocationSchema,
  symbolLocationSchema,
  definitionSchema,
  hoverSchema,
  diagnosticsSchema,
  formattingOptionsSchema,
  // Indexer schemas
  indexFilesSchema,
  searchSymbolSchema,
  clearIndexSchema,
  // Config schemas
  configSchema,
  adapterConfigSchema,
  serverCharacteristicsSchema,
  memoryConfigSchema,
  indexConfigSchema,
  // Memory schemas
  listMemoriesSchema,
  readMemorySchema,
  writeMemorySchema,
  deleteMemorySchema,
  searchMemoriesSchema,
  mergeMemoriesSchema,
  compressMemorySchema,
} from "./validators/index.ts";

// Convenience re-exports
export type {
  // LSP Protocol
  LSPRequest,
  LSPResponse,
  LSPNotification,
  LSPMessage,
  LSPMethod,
} from "./lsp/protocol.ts";

export type {
  // Symbols
  IndexedSymbol,
  SymbolSearchOptions,
  SymbolIndexStats,
} from "./lsp/symbols.ts";

export type {
  // Diagnostics
  DiagnosticResult,
  DiagnosticStats,
  FormattedDiagnostic,
} from "./lsp/diagnostics.ts";

export {
  // Builders
  DiagnosticResultBuilder,
  ReferenceResultBuilder,
  SymbolResultBuilder,
  type SimpleDiagnostic,
} from "./shared/resultBuilders.ts";

export type {
  // File system
  FileSystemApi,
  FileResolutionResult,
  FileLineResolutionResult,
  FileSymbolResolutionResult,
} from "./domain/filesystem.ts";

export type {
  // Project
  ProjectOverview,
  ProjectStructure,
  ProjectStatistics,
  Memory,
} from "./domain/project.ts";

export type {
  // Indexer
  SymbolIndex,
  IndexStats,
  IndexingResult,
  IndexConfiguration,
} from "./domain/indexer.ts";

export type {
  // Tools
  ToolDefinition,
  MCPServer,
  MCPRequest,
  MCPResponse,
} from "./domain/tools.ts";

export {
  // Tool schemas
  toolSchemas,
} from "./domain/tools.ts";

export type {
  // Result type
  Result,
} from "./shared/result.ts";

export type {
  // MCP types
  McpContext,
  McpToolDef,
  McpServerOptions,
} from "./domain/mcp.ts";

export type {
  // Adapter types (FileSystem has been unified to FileSystemApi)
  LspClientAdapter,
  LspClientProvider,
  LspClientConfig,
} from "./domain/adapters.ts";
