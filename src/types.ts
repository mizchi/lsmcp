import type { ToolDef } from "./mcp/_mcplib.ts";

/**
 * Common LSP configuration fields
 */
export interface BaseLspConfig {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** File extensions supported (e.g., [".ts", ".tsx"]) */
  extensions: string[];

  /** Command line arguments for the LSP server */
  lspArgs?: string[];

  /** LSP initialization options */
  initializationOptions?: unknown;
}

/**
 * Language configuration for lsmcp
 */
export interface LanguageConfig extends BaseLspConfig {
  /** LSP server command or function to get the command */
  lspCommand: string | (() => string);

  /** Pre-initialization hook (before LSP server starts) */
  preInitialize?: (projectRoot: string) => Promise<void>;

  /** Post-initialization hook (after LSP connection established) */
  postInitialize?: (
    client: {
      sendRequest: (method: string, params?: unknown) => Promise<unknown>;
      sendNotification: (method: string, params?: unknown) => void;
    },
    projectRoot: string,
  ) => Promise<void>;

  /** Language-specific MCP tools */
  customTools?: ToolDef<any>[];

  /** Check if the language server is available and properly configured */
  doctor?: () => Promise<{ ok: boolean; message?: string }>;
}

/**
 * LSP adapter configuration
 * Provides specific configuration for an LSP server implementation
 * This type is JSON-serializable for configuration files
 */
export interface LspAdapter extends BaseLspConfig {
  /** LSP server command */
  lspCommand: string;

  /** Base language this adapter is for */
  baseLanguage: string;

  /** Description of what makes this adapter different */
  description: string;

  /** Language-specific MCP tools */
  customTools?: ToolDef<any>[];

  /** Check if the language server is available and properly configured */
  doctor?: () => Promise<{ ok: boolean; message?: string }>;
}

/**
 * Configuration file format for --config option
 * This is the same as LspAdapter for simplicity
 */
export type LanguageConfigJson = LspAdapter;
