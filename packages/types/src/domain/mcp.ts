/**
 * MCP (Model Context Protocol) related types
 */

import type { z, ZodType } from "zod";
import type { FileSystemApi } from "./filesystem.ts";
import type { LspClientAdapter } from "./adapters.ts";

/**
 * MCP execution context passed to tools
 */
export interface McpContext {
  /** LSP client adapter instance (required) */
  lspClient: LspClientAdapter;
  /** File system API (required) */
  fs: FileSystemApi;
  /** Configuration */
  config?: Record<string, unknown>;
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
 * Context-aware MCP Tool definition
 * Tools that require context should use this interface
 */
export interface McpToolDefWithContext<TSchema extends ZodType> {
  name: string;
  description: string;
  schema: TSchema;
  requiresContext: true;
  execute: (args: z.infer<TSchema>, context: McpContext) => Promise<string>;
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
