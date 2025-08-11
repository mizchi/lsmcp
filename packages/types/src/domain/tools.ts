// Tool and MCP-related domain types

import { z } from "zod";

export interface ToolDefinition<TSchema extends z.ZodTypeAny = z.ZodAny> {
  name: string;
  description: string;
  schema: TSchema;
  execute: (params: z.infer<TSchema>) => Promise<any>;
  examples?: ToolExample[];
}

export interface ToolExample {
  description: string;
  params: any;
  result?: any;
}

export interface ToolRegistry {
  register<T extends z.ZodTypeAny>(tool: ToolDefinition<T>): void;
  get(name: string): ToolDefinition | undefined;
  list(): ToolDefinition[];
  has(name: string): boolean;
  execute(name: string, params: any): Promise<any>;
}

export interface MCPServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  registerTool<T extends z.ZodTypeAny>(tool: ToolDefinition<T>): void;
  handleRequest(request: MCPRequest): Promise<MCPResponse>;
}

export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPCapabilities {
  tools?: boolean;
  prompts?: boolean;
  resources?: boolean;
  logging?: boolean;
  experimental?: Record<string, any>;
}

// Common tool parameter schemas
export const commonSchemas = {
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z.string().describe("File path (relative to root)"),
  line: z.union([
    z.number().describe("Line number (1-based)"),
    z.string().describe("String to match in the line"),
  ]),
  symbolName: z.string().describe("Name of the symbol"),
  includeBody: z
    .boolean()
    .optional()
    .describe("Include the full body of the symbol"),
  before: z.number().optional().describe("Number of lines to show before"),
  after: z.number().optional().describe("Number of lines to show after"),
} as const;
