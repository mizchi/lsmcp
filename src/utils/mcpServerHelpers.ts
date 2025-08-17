import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, ZodObject, type ZodType } from "zod";
import { createCompatibleTransport } from "./compatibleTransport.ts";
import type { McpToolDef, McpContext } from "@internal/types";
import type { FileSystemApi } from "@internal/types";
import { debugLogWithPrefix } from "./debugLog.ts";
import type { McpPromptDef } from "../mcp/prompts/promptDefinitions.ts";
import { toMcpPromptHandler } from "../mcp/prompts/promptDefinitions.ts";

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
  fileSystemApi?: FileSystemApi;
}

/**
 * MCP Server state
 */
export interface McpServerState {
  server: McpServer;
  tools: Map<string, McpToolDef<ZodType>>;
  prompts: Map<string, McpPromptDef<ZodType>>;
  defaultRoot?: string;
  fileSystemApi?: FileSystemApi;
  context?: McpContext;
}

/**
 * Convert a string-returning handler to MCP response format with error handling
 */
export function toMcpToolHandler<T>(
  handler: (args: T, context?: McpContext) => Promise<string> | string,
  context?: McpContext,
): (args: T, extra?: any) => Promise<any> {
  return async (args: T, _extra?: any) => {
    try {
      const message = await handler(args, context);
      return {
        content: [
          {
            type: "text",
            text: message,
          },
        ],
      };
    } catch (error) {
      debugLogWithPrefix(
        "MCP",
        `Tool execution error in ${
          (handler as any).name || "unknown"
        }: ${error}`,
      );

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  };
}

/**
 * Create an MCP server instance
 */
export function createMcpServer(options: McpServerOptions): McpServerState {
  const server = new McpServer({
    name: options.name,
    version: options.version,
  });

  return {
    server,
    tools: new Map(),
    prompts: new Map(),
    defaultRoot: undefined,
    fileSystemApi: options.fileSystemApi,
  };
}

/**
 * Set default root directory for tools that accept a root parameter
 */
export function setDefaultRoot(state: McpServerState, root: string): void {
  state.defaultRoot = root;
}

/**
 * Register a tool with the server
 */
export function registerTool<S extends ZodType>(
  state: McpServerState,
  tool: McpToolDef<S>,
): void {
  state.tools.set(tool.name, tool as unknown as McpToolDef<ZodType>);
  _registerToolWithServer(state, tool);
}

/**
 * Register multiple tools at once
 */
export function registerTools(
  state: McpServerState,
  tools: McpToolDef<ZodType>[],
): void {
  for (const tool of tools) {
    registerTool(state, tool);
  }
}

/**
 * Register a prompt with the server
 */
export function registerPrompt<S extends ZodType>(
  state: McpServerState,
  prompt: McpPromptDef<S>,
): void {
  state.prompts.set(prompt.name, prompt as unknown as McpPromptDef<ZodType>);
  _registerPromptWithServer(state, prompt);
}

/**
 * Register multiple prompts at once
 */
export function registerPrompts(
  state: McpServerState,
  prompts: McpPromptDef<ZodType>[],
): void {
  for (const prompt of prompts) {
    registerPrompt(state, prompt);
  }
}

/**
 * Start the server with stdio transport
 */
export async function startServer(state: McpServerState): Promise<void> {
  // Use compatible transport that handles protocol version format differences
  const transport = createCompatibleTransport();
  await state.server.connect(transport);
}

/**
 * Get the underlying MCP server instance
 */
export function getServer(state: McpServerState): McpServer {
  return state.server;
}

/**
 * Internal method to register tool with MCP server
 */
function _registerToolWithServer<S extends ZodType>(
  state: McpServerState,
  tool: McpToolDef<S>,
): void {
  // Check if the schema is a ZodObject to extract shape
  if (tool.schema instanceof ZodObject) {
    const schemaShape = tool.schema.shape;

    // Create a wrapper handler that adds default root if not provided
    const wrappedHandler =
      state.defaultRoot && "root" in schemaShape
        ? (args: z.infer<S>) => {
            // If root is not provided in args, use the default
            const argsWithRoot = {
              ...args,
              root:
                (typeof args === "object" && args !== null && "root" in args
                  ? (args as Record<string, unknown>).root
                  : undefined) || state.defaultRoot,
            } as z.infer<S>;
            return tool.execute(argsWithRoot, state.context);
          }
        : (args: z.infer<S>) => tool.execute(args, state.context);

    // Register tool with McpServer using the correct overload
    if (tool.description) {
      state.server.tool(
        tool.name,
        tool.description,
        schemaShape,
        toMcpToolHandler(wrappedHandler, state.context),
      );
    } else {
      state.server.tool(
        tool.name,
        schemaShape,
        toMcpToolHandler(wrappedHandler, state.context),
      );
    }
  } else {
    // For non-ZodObject schemas, register without shape
    if (tool.description) {
      state.server.tool(
        tool.name,
        tool.description,
        toMcpToolHandler(tool.execute),
      );
    } else {
      state.server.tool(tool.name, toMcpToolHandler(tool.execute));
    }
  }
}

/**
 * Internal method to register prompt with MCP server
 */
function _registerPromptWithServer<S extends ZodType>(
  state: McpServerState,
  prompt: McpPromptDef<S>,
): void {
  // Check if the schema is a ZodObject to extract shape
  if (prompt.schema && prompt.schema instanceof ZodObject) {
    const schemaShape = prompt.schema.shape;

    // Create a wrapper handler that adds default root if not provided
    const wrappedHandler =
      state.defaultRoot && "root" in schemaShape
        ? (args: z.infer<S>) => {
            // If root is not provided in args, use the default
            const argsWithRoot = {
              ...args,
              root:
                (typeof args === "object" && args !== null && "root" in args
                  ? (args as Record<string, unknown>).root
                  : undefined) || state.defaultRoot,
            } as z.infer<S>;
            return prompt.execute(argsWithRoot, state.context);
          }
        : (args: z.infer<S>) => prompt.execute(args, state.context);

    // Register prompt with McpServer using the args schema
    state.server.prompt(
      prompt.name,
      schemaShape,
      toMcpPromptHandler(wrappedHandler, prompt.description, state.context),
    );
  } else {
    // For prompts without schema
    const handler = (args: z.infer<S>) => prompt.execute(args, state.context);

    state.server.prompt(
      prompt.name,
      {},
      toMcpPromptHandler(handler, prompt.description, state.context),
    );
  }
}

/**
 * Create an MCP server manager for convenience
 */
export interface McpServerManager {
  state: McpServerState;
  setDefaultRoot: (root: string) => void;
  setContext: (context: McpContext) => void;
  registerTool: <S extends ZodType>(tool: McpToolDef<S>) => void;
  registerTools: (tools: McpToolDef<ZodType>[]) => void;
  registerPrompt: <S extends ZodType>(prompt: McpPromptDef<S>) => void;
  registerPrompts: (prompts: McpPromptDef<ZodType>[]) => void;
  start: () => Promise<void>;
  getServer: () => McpServer;
}

/**
 * Create an MCP server manager with bound methods
 */
export function createMcpServerManager(
  options: McpServerOptions,
): McpServerManager {
  const state = createMcpServer(options);

  return {
    state,
    setDefaultRoot: (root: string) => setDefaultRoot(state, root),
    setContext: (context: McpContext) => {
      state.context = context;
    },
    registerTool: <S extends ZodType>(tool: McpToolDef<S>) =>
      registerTool(state, tool),
    registerTools: (tools: McpToolDef<ZodType>[]) =>
      registerTools(state, tools),
    registerPrompt: <S extends ZodType>(prompt: McpPromptDef<S>) =>
      registerPrompt(state, prompt),
    registerPrompts: (prompts: McpPromptDef<ZodType>[]) =>
      registerPrompts(state, prompts),
    start: () => startServer(state),
    getServer: () => getServer(state),
  };
}
