/**
 * LSP Client Package - Public API
 * 
 * This module exports the minimal public API for LSP client functionality.
 */

// ============================================================================
// Core Client API
// ============================================================================
export { 
  createLSPClient,
  createAndInitializeLSPClient,
  type LSPClient 
} from "./core/client.ts";

export type { 
  LSPClientConfig,
  LSPProcessState as LSPClientState 
} from "./core/state.ts";

// ============================================================================
// Essential Protocol Types
// ============================================================================
export type {
  Position,
  Range,
  Location,
  Diagnostic,
  CompletionItem,
  SymbolInformation,
  DocumentSymbol,
  WorkspaceEdit,
  TextEdit,
  TextDocumentIdentifier,
  TextDocumentPositionParams,
  MarkupContent,
  SignatureHelp,
  Hover,
  CodeAction,
  Command,
  FormattingOptions,
  ServerCapabilities,
} from "./protocol/types/index.ts";

// Export enums and additional types from vscode-languageserver-protocol
export {
  DiagnosticSeverity,
  CompletionItemKind,
  SymbolKind,
  MarkupKind,
  CodeActionKind,
  type SignatureInformation,
  type ParameterInformation,
  type LocationLink,
} from "vscode-languageserver-protocol";

// ============================================================================
// Language Support
// ============================================================================
export { getLanguageIdFromPath } from "./client/context.ts";

// ============================================================================
// Symbol Provider (for code-indexer integration)
// ============================================================================
export { createLSPSymbolProvider } from "./providers.ts";

// ============================================================================
// Temporary exports for internal use (will be removed in future refactoring)
// ============================================================================
export { debug } from "./utils/debug.ts";
export { CapabilityChecker, createToolCapabilityMap } from "./capabilities/CapabilityChecker.ts";
export { withTemporaryDocument } from "./lsp-utils/documentManager.ts";
export { validateLineAndSymbol } from "./utils/validation.ts";
export { resolveLineParameter } from "./utils/container-helpers.ts";
export type { ErrorContext } from "./utils/container-helpers.ts";
export { formatError } from "./utils/container-helpers.ts";
export { loadFileContext } from "./lsp-utils/fileContext.ts";
export { withLSPOperation } from "./client/lspOperations.ts";
export { createCompletionHandler } from "./commands/completion.ts";
export { defaultLog as log, LogLevel } from "./utils/logger.ts";
export { waitForDiagnosticsWithRetry, isLargeFile } from "./diagnostics/utils.ts";
export { resolveLineIndexOrThrow } from "./lsp-utils/lineResolver.ts";
export { createAdvancedCompletionHandler } from "./commands/completion.ts";
export { 
  createTypescriptLSPClient,
  openDocument,
  stopLSPClient,
  waitForDocumentProcessed
} from "./utils/typescript-helpers.ts";