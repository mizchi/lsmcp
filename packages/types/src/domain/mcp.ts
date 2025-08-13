/**
 * MCP (Model Context Protocol) related types
 */

import type { z, ZodType } from "zod";

/**
 * MCP Tool definition interface
 */
export interface McpToolDef<TSchema extends ZodType> {
  name: string;
  description: string;
  schema: TSchema;
  execute: (args: z.infer<TSchema>) => Promise<string>;
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
