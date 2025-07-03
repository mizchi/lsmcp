import type { ToolDef } from "./mcp/utils/mcpHelpers.ts";

/**
 * Common LSP configuration fields
 */
export interface BaseLspConfig {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** LSP server binary command */
  bin: string;

  /** Command line arguments for the LSP server */
  args?: string[];

  /** LSP initialization options */
  initializationOptions?: unknown;
}

/**
 * Language configuration for lsmcp
 */
export interface LanguageConfig extends BaseLspConfig {
  /** Pre-initialization hook (before LSP server starts) */
  preInitialize?: (projectRoot: string) => Promise<void>;

  /** Language-specific MCP tools */
  customTools?: ToolDef<import("zod").ZodType>[];

  /** Check if the language server is available and properly configured */
  doctor?: () => Promise<{ ok: boolean; message?: string }>;
}

/**
 * LSP adapter configuration
 * Provides specific configuration for an LSP server implementation
 * This type is JSON-serializable for configuration files
 */
export interface LspAdapter extends BaseLspConfig {
  /** Base language this adapter is for */
  baseLanguage: string;

  /** Description of what makes this adapter different */
  description: string;

  /** List of LSP features that are not supported by this adapter */
  unsupported?: string[];

  /** Whether diagnostics need deduplication (e.g., for servers that report duplicates) */
  needsDiagnosticDeduplication?: boolean;

  /** Language-specific MCP tools */
  customTools?: ToolDef<import("zod").ZodType>[];

  /** Check if the language server is available and properly configured */
  doctor?: () => Promise<{ ok: boolean; message?: string }>;
}

/**
 * Configuration file format for --config option
 * This is the same as LspAdapter for simplicity
 */
export type LanguageConfigJson = LspAdapter;
