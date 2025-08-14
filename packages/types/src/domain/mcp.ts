/**
 * MCP (Model Context Protocol) related types
 */

import type { z, ZodType } from "zod";
import type { FileSystemApi } from "./filesystem.ts";

/**
 * MCP execution context passed to tools
 */
export interface McpContext {
  /** LSP client instance (any type that implements LSP operations) */
  lspClient: any; // Using 'any' to avoid circular dependency with LSPClient
  /** File system API (required) */
  fs: FileSystemApi;
  /** Configuration */
  config?: Record<string, unknown>;
  /** Language ID or preset ID for language-specific handling */
  languageId?: string;
}

/**
 * MCP Tool definition interface
 */
export interface McpToolDef<TSchema extends ZodType> {
  name: string;
  description: string;
  schema: TSchema;
  execute: (args: z.infer<TSchema>, context?: McpContext) => Promise<string>;
}

/**
 * MCP Server configuration options
 */
export interface McpServerOptions {
  name: string;
  version: string;
  description?: string;
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}
