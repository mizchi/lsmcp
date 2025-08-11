// Main entry point for @lsmcp/types package

// LSP types
export * from "./lsp/index.ts";

// Domain types
export * from "./domain/index.ts";

// Shared utilities
export * from "./shared/index.ts";

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
  LocationResultBuilder,
  SymbolResultBuilder,
  type SimpleDiagnostic,
} from "./lsp/builders.ts";

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
  // Adapter
  LspAdapter,
  ServerCharacteristics,
  AdapterCapabilities,
} from "./domain/adapter.ts";

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

export type {
  // Result type
  Result,
} from "./shared/result.ts";

// Re-export utilities
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
} from "./shared/errors.ts";

export {
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
} from "./shared/result.ts";

export {
  // Type guards
  isObject,
  isString,
  isNumber,
  isBoolean,
  isArray,
  isFunction,
  isDefined,
  isNotNull,
  isNotNullish,
  // Utilities
  sleep,
  debounce,
  throttle,
  memoize,
} from "./shared/utils.ts";
