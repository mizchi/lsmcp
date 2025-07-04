import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z, ZodObject, type ZodType } from "zod";
import type { ToolDef } from "./mcpHelpers.ts";

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

/**
 * MCP Server state
 */
interface McpServerState {
  server: McpServer;
  tools: Map<string, ToolDef<ZodType>>;
  defaultRoot?: string;
}

/**
 * Convert a string-returning handler to MCP response format with error handling
 */
export function toMcpToolHandler<T>(
  handler: (args: T) => Promise<string> | string,
): (args: T, extra?: any) => Promise<any> {
  return async (args: T, _extra?: any) => {
    try {
      const message = await handler(args);
      return {
        content: [
          {
            type: "text",
            text: message,
          },
        ],
      };
    } catch (error) {
      console.error(
        `[MCP] Tool execution error in ${
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
    defaultRoot: undefined,
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
  tool: ToolDef<S>,
): void {
  state.tools.set(tool.name, tool as unknown as ToolDef<ZodType>);
  _registerToolWithServer(state, tool);
}

/**
 * Register multiple tools at once
 */
export function registerTools(
  state: McpServerState,
  tools: ToolDef<ZodType>[],
): void {
  for (const tool of tools) {
    registerTool(state, tool);
  }
}

/**
 * Start the server with stdio transport
 */
export async function startServer(state: McpServerState): Promise<void> {
  const transport = new StdioServerTransport();
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
  tool: ToolDef<S>,
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
            return tool.execute(argsWithRoot);
          }
        : tool.execute;

    // Register tool with McpServer using the correct overload
    if (tool.description) {
      state.server.tool(
        tool.name,
        tool.description,
        schemaShape,
        toMcpToolHandler(wrappedHandler),
      );
    } else {
      state.server.tool(
        tool.name,
        schemaShape,
        toMcpToolHandler(wrappedHandler),
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
 * Create an MCP server manager for convenience
 */
export interface McpServerManager {
  state: McpServerState;
  setDefaultRoot: (root: string) => void;
  registerTool: <S extends ZodType>(tool: ToolDef<S>) => void;
  registerTools: (tools: ToolDef<ZodType>[]) => void;
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
    registerTool: <S extends ZodType>(tool: ToolDef<S>) =>
      registerTool(state, tool),
    registerTools: (tools: ToolDef<ZodType>[]) => registerTools(state, tools),
    start: () => startServer(state),
    getServer: () => getServer(state),
  };
}
