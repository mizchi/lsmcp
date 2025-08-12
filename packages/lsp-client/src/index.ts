/**
 * LSP Client Package - Public API
 */

// ============================================================================
// Core Client API
// ============================================================================
export { createLSPClient } from "./core/client.ts";
export type { LSPClient } from "./protocol/types-legacy.ts";
export type { LSPClientConfig, LSPClientState } from "./core/state.ts";

// Factory function for creating and initializing clients
export { createAndInitializeLSPClient } from "./core/client-legacy.ts";

// ============================================================================
// Protocol Types
// ============================================================================
export * from "./protocol/types-legacy.ts";

// ============================================================================
// Process Management
// ============================================================================
export { lspProcessPool, type PooledLSPClient } from "./process-pool.ts";

// ============================================================================
// Document Management
// ============================================================================
export { DocumentManager } from "./managers/document-manager.ts";
export { withTemporaryDocument } from "./lsp-utils/documentManager.ts";

// ============================================================================
// Diagnostics
// ============================================================================
export { DiagnosticsManager } from "./diagnostics/manager.ts";
export { waitForDiagnosticsWithRetry } from "./diagnostics/utils.ts";

// ============================================================================
// Workspace
// ============================================================================
export { applyWorkspaceEditManually } from "./utils/workspace-edit.ts";

// ============================================================================
// Context & Language Support
// ============================================================================
export {
  createLSPClientContext,
  getLanguageIdFromPath,
  type LSPClientContext,
} from "./client/context.ts";

// ============================================================================
// Operations
// ============================================================================
export {
  withLSPOperation,
  withBatchLSPOperation,
  type LSPOperationOptions,
  type BatchLSPOperationOptions,
} from "./client/lspOperations.ts";

// ============================================================================
// Adapters & Validation (for testing)
// ============================================================================
export { validateLspAdapter as validateAdapter } from "./utils/adapter-utils.ts";
export { LSPValidator, type LSPValidationResult } from "./utils/validator.ts";

// ============================================================================
// Global Client Access (for compatibility)
// ============================================================================
export { getActiveClient as getLSPClient } from "./client/global-state.ts";

// ============================================================================
// TypeScript-specific helpers (for TypeScript tools)
// ============================================================================
export {
  createTypescriptLSPClient,
  openDocument,
  stopLSPClient,
  waitForDocumentProcessed,
  type TypescriptClientInstance,
} from "./utils/typescript-helpers.ts";

// ============================================================================
// Testing Utilities
// ============================================================================
export {
  setupLSPForTest,
  teardownLSPForTest,
  getCurrentTestClient,
} from "./testing/helpers.ts";

// ============================================================================
// Debug & Logging
// ============================================================================
export {
  defaultLog,
  LogLevel,
  type LogEntry,
} from "./utils/logger.ts";

// ============================================================================
// Providers
// ============================================================================
export { createLSPSymbolProvider } from "./providers.ts";

// ============================================================================
// Tool Creation Utilities (for MCP tools)
// ============================================================================
export { createLSPTool } from "./client/toolFactory.ts";
export type { ToolDef } from "./client/toolFactory.ts";

// ============================================================================
// File & Line Utilities (for MCP tools)
// ============================================================================
export { loadFileContext } from "./lsp-utils/fileContext.ts";
export { resolveLineIndexOrThrow } from "./lsp-utils/lineResolver.ts";

// ============================================================================
// Utilities (for MCP tools)
// ============================================================================
export {
  formatError,
  resolveLineParameter,
  debug,
  getServerCharacteristics,
} from "./utils/container-helpers.ts";
export type { ErrorContext } from "./utils/container-helpers.ts";
export { validateLineAndSymbol } from "./utils/validation.ts";
