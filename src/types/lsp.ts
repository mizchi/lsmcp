/**
 * LSP-related type definitions
 */

import type { ToolDef } from "../mcp/utils/mcpHelpers.ts";
import type { ZodType } from "zod";

/**
 * Server characteristics that affect LSP client behavior
 * These are runtime characteristics, not capabilities
 */
export interface ServerCharacteristics {
  /** Time to wait after opening a document before sending requests (ms) */
  documentOpenDelay?: number;

  /** Time to wait for server readiness check (ms) */
  readinessCheckTimeout?: number;

  /** Time to wait for initial diagnostics (ms) */
  initialDiagnosticsTimeout?: number;

  /** Whether the server requires project-level initialization */
  requiresProjectInit?: boolean;

  /** Whether the server sends diagnostics on document open */
  sendsInitialDiagnostics?: boolean;

  /** Maximum timeout for general operations (ms) */
  operationTimeout?: number;

  /** Whether the server supports incremental document synchronization */
  supportsIncrementalSync?: boolean;

  /** Whether the server supports pull diagnostics */
  supportsPullDiagnostics?: boolean;
}

/**
 * LSP server capabilities
 * What features the LSP server supports
 */
export interface ServerCapabilities {
  supportsRename?: boolean;
  supportsReferences?: boolean;
  supportsDefinition?: boolean;
  supportsHover?: boolean;
  supportsDocumentSymbol?: boolean;
  supportsWorkspaceSymbol?: boolean;
  supportsCompletion?: boolean;
  supportsSignatureHelp?: boolean;
  supportsDocumentFormatting?: boolean;
  supportsRangeFormatting?: boolean;
  supportsCodeAction?: boolean;
  supportsDiagnostics?: boolean;
  supportsInlayHint?: boolean;
  supportsSemanticTokens?: boolean;
}

/**
 * LSP adapter configuration
 * Defines how to connect to and configure a language server
 */
export interface LspAdapter {
  /** Unique identifier (e.g., "typescript", "pyright") */
  id: string;

  /** Display name (e.g., "TypeScript Language Server") */
  name: string;

  /** Base language this adapter supports (e.g., "typescript", "python") */
  baseLanguage: string;

  /** Brief description of the adapter */
  description: string;

  /** LSP server binary command */
  bin: string;

  /** Command line arguments for the LSP server */
  args?: string[];

  /** LSP initialization options */
  initializationOptions?: unknown;

  /** List of unsupported LSP features (e.g., ["rename_symbol", "get_code_actions"]) */
  unsupported?: string[];

  /** Whether diagnostics need deduplication */
  needsDiagnosticDeduplication?: boolean;

  /** Custom MCP tools specific to this adapter */
  customTools?: ToolDef<ZodType>[];

  /** Health check function */
  doctor?: () => Promise<{ ok: boolean; message?: string }>;

  /** Server-specific behavior characteristics */
  serverCharacteristics?: ServerCharacteristics;

  /** Server capabilities */
  serverCapabilities?: ServerCapabilities;
}

/**
 * Configuration file format (JSON-serializable subset of LspAdapter)
 */
export type LanguageConfigJson = Omit<LspAdapter, "customTools" | "doctor">;
