/**
 * LSP Client Package - Public API
 */

import type { LSPClient } from "./protocol/types/index.ts";

// ============================================================================
// Core Client API
// ============================================================================
export { createLSPClient } from "./core/client.ts";
export type { LSPClient } from "./protocol/types/index.ts";
export type { LSPClientConfig, LSPClientState } from "./core/state.ts";

// Factory function for creating and initializing clients
export { createAndInitializeLSPClient } from "./core/client-legacy.ts";

// ============================================================================
// Protocol Types
// ============================================================================
export * from "./protocol/types/index.ts";

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
export { DiagnosticsManager } from "./managers/diagnostics.ts";
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
// Commands
// ============================================================================
export { createCompletionHandler } from "./commands/completion.ts";

// ============================================================================
// Adapters & Validation (for testing)
// ============================================================================
export { validateLspAdapter as validateAdapter } from "./utils/adapter-utils.ts";
export { LSPValidator, type LSPValidationResult } from "./utils/validator.ts";

// ============================================================================
// Client Management
// ============================================================================
export { ClientManager, type ManagedClient } from "./client/client-manager.ts";

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
  defaultGetSession as getSession,
  defaultExportSession as exportSession,
  defaultExportSessionText as exportSessionText,
} from "./utils/logger.ts";

// ============================================================================
// Diagnostics Utils
// ============================================================================
export { isLargeFile } from "./diagnostics/utils.ts";

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

// ============================================================================
// Testing Support (for tests)
// ============================================================================
export { createLSPClient as initialize } from "./core/client.ts";
export async function shutdown(client: LSPClient): Promise<void> {
  if (client && typeof client.stop === 'function') {
    await client.stop();
  }
}

// Direct shutdown function - no global state
export async function shutdownLSPClient(client: LSPClient): Promise<void> {
  if (client) {
    await shutdown(client);
  }
}

// Direct initialization function - no global state
export async function initializeLSPClient(client: LSPClient): Promise<void> {
  if (client && typeof client.start === 'function') {
    await client.start();
  }
}

// Re-export tools for tests (these are now in src/mcp-tools)
// Legacy exports for backward compatibility - will be removed
// These are now null to indicate they should not be used
export const lspGetHoverTool = null as any;
export const lspFindReferencesTool = null as any;
export const lspGetDefinitionsTool = null as any;
export const lspGetDiagnosticsTool = null as any;
export const lspRenameSymbolTool = null as any;
export const lspGetDocumentSymbolsTool = null as any;
export const lspDeleteSymbolTool = null as any;
