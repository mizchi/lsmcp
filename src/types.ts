import type { ToolDef } from "./mcp/utils/mcpHelpers.ts";
import type { ZodType } from "zod";

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
}

/**
 * Legacy language configuration type
 * @deprecated Use LspAdapter instead
 */
export interface LanguageConfig {
  id: string;
  name: string;
  bin: string;
  args?: string[];
  initializationOptions?: unknown;
  preInitialize?: (projectRoot: string) => Promise<void>;
  customTools?: ToolDef<ZodType>[];
  doctor?: () => Promise<{ ok: boolean; message?: string }>;
}

/**
 * Configuration file format (JSON-serializable subset of LspAdapter)
 */
export type LanguageConfigJson = Omit<LspAdapter, "customTools" | "doctor">;
