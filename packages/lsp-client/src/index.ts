// Core LSP client exports
export { type LSPClient, createLSPClient } from "./lspClient.ts";
export { createLSPClient as createLSPClientFactory } from "./client/lspClientFactory.ts";
export {
  withLSPOperation,
  withBatchLSPOperation,
  ensureLSPClient,
  type LSPOperationOptions,
  type BatchLSPOperationOptions,
} from "./client/lspOperations.ts";
export { lspProcessPool, type PooledLSPClient } from "./lspProcessPool.ts";

// Global client management (main exports)
export {
  getActiveClient,
  setActiveClient,
  getLSPClient,
  initialize,
  shutdown,
  getLanguageIdFromPath,
} from "./globalClientManager.ts";

// Deprecated exports from lspClient (for backward compatibility)
export {
  getActiveClient as getActiveClientLegacy,
  setActiveClient as setActiveClientLegacy,
  getLSPClient as getLSPClientLegacy,
  initialize as initializeLegacy,
} from "./lspClient.ts";

// Document management
export { DocumentManager } from "./documentManager.ts";
export { withTemporaryDocument } from "./lsp-utils/documentManager.ts";
export * from "./lsp-utils/fileContext.ts";
export * from "./lsp-utils/lineResolver.ts";

// Diagnostics
export { DiagnosticsManager } from "./diagnosticsManager.ts";
export * from "./diagnosticUtils.ts";
export { waitForDiagnosticsWithRetry } from "./diagnosticUtils.ts";

// Protocol and request management
export * from "./protocol.ts";
export { RequestManager } from "./requestManager.ts";

// Workspace
export * from "./workspaceEditHandler.ts";

// Commands
export * from "./commands/index.ts";
export { createAdvancedCompletionHandler } from "./commands/completion.ts";
export {
  type LSPCommand,
  type LSPRequestSender,
  type TextDocumentParams,
  type CompletionParams,
  type CodeActionParams,
  type FormattingParams,
  type RangeFormattingParams,
  type RenameParams,
  type RenameResult,
  locationLinkToLocation,
  isLocationLink,
  isLocationLinkArray,
  isCompletionList,
} from "./commands/types.ts";

// Tools
export { lspGetHoverTool } from "./tools/hover.ts";
export { lspGetDefinitionsTool } from "./tools/definitions.ts";
export { lspFindReferencesTool } from "./tools/references.ts";
export { lspGetDiagnosticsTool } from "./tools/diagnostics.ts";
export { lspGetDocumentSymbolsTool } from "./tools/documentSymbols.ts";
export { lspGetCompletionTool } from "./tools/completion.ts";
export { lspGetSignatureHelpTool } from "./tools/signatureHelp.ts";
export { lspFormatDocumentTool } from "./tools/formatting.ts";
export { lspGetCodeActionsTool } from "./tools/codeActions.ts";
export { lspRenameSymbolTool } from "./tools/rename.ts";
export { lspGetWorkspaceSymbolsTool } from "./tools/workspaceSymbols.ts";
export { lspGetAllDiagnosticsTool } from "./tools/allDiagnostics.ts";
export { lspCheckCapabilitiesTool } from "./tools/checkCapabilities.ts";
export { lspValidateAdapterTool } from "./tools/validateAdapter.ts";
export { lspDeleteSymbolTool } from "./tools/deleteSymbol.ts";
export { lspExportDebugSessionTool } from "./tools/exportDebugSession.ts";

// Types and utilities (excluding duplicates from commands/types.ts)
export {
  type LSPRequest,
  type LSPResponse,
  type LSPNotification,
  type LSPMessage,
  isLSPRequest,
  isLSPResponse,
  isLSPNotification,
  type TextDocumentIdentifier,
  type PublishDiagnosticsParams,
  type ReferenceContext,
  type ClientCapabilities,
  type InitializeParams,
  type WorkspaceFolder,
  type ServerCapabilities,
  type InitializeResult,
  type TextDocumentItem,
  type DidOpenTextDocumentParams,
  type VersionedTextDocumentIdentifier,
  type TextDocumentContentChangeEvent,
  type DidChangeTextDocumentParams,
  type DidCloseTextDocumentParams,
  type ApplyWorkspaceEditParams,
  type ApplyWorkspaceEditResponse,
  type WorkspaceSymbolResult,
  type HoverContents,
  type LSPClientState,
  type LSPClientConfig,
  type LSPClient as LSPClientType,
  // Re-exported vscode types
  CodeAction,
  Command,
  CompletionItem,
  Diagnostic,
  DocumentSymbol,
  Location,
  LocationLink,
  Position,
  Range,
  SymbolInformation,
  TextEdit,
  WorkspaceEdit,
} from "./lspTypes.ts";
export * from "./lspValidator.ts";
export * from "./lspAdapterUtils.ts";
export * from "./lspTester.ts";
export * from "./testHelpers.ts";
export * from "./debugLogger.ts";

// Tool factory
export {
  createTool,
  createLSPTool,
  createLSPTools,
  type ToolDef,
  type CreateToolOptions,
  type CreateLSPToolOptions,
} from "./client/toolFactory.ts";

// Debug logger
export { LogLevel, defaultLog } from "./debugLogger.ts";

// Dependency injection
export * from "./interfaces/index.ts";
export * from "./implementations/defaults.ts";
export {
  container,
  configureLSPClient,
  resetLSPClientConfiguration,
} from "./container/index.ts";
export {
  debug,
  debugLog,
  formatError,
  resolveLineParameter,
  getServerCharacteristics,
  nodeFileSystemApi,
  type ErrorContext,
  type FileSystemApi,
} from "./utils/container-helpers.ts";

// TypeScript-specific helpers
export {
  createTypescriptLSPClient,
  openDocument,
  stopLSPClient,
  waitForDocumentProcessed,
  type TypescriptClientInstance,
} from "./typescript/helpers.ts";
