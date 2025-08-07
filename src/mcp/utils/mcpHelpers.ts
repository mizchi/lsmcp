/**
 * Generic MCP (Model Context Protocol) Server Library
 * Provides utilities and base classes for building MCP servers
 */

import { type z, type ZodType } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import { MCPToolError } from "../../core/pure/mcpErrors.ts";

/**
 * Debug logging for MCP servers.
 *
 * IMPORTANT: MCP servers communicate via stdio, so regular console.log output
 * would interfere with the protocol. All debug/logging output MUST be sent
 * to stderr using console.error instead.
 *
 * This function provides a convenient way to output debug messages that won't
 * interfere with MCP communication.
 *
 * Debug output is only shown when LSMCP_DEBUG=1 environment variable is set.
 *
 * @example
 * debug("Server started");
 * debug("Processing request:", requestData);
 */
export function debug(...args: unknown[]): void {
  if (process.env.LSMCP_DEBUG === "1") {
    console.error(...args);
  }
}

// Re-export commonly used types
export { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
export * from "./mcpServerHelpers.ts";

/**
 * Tool result format for MCP
 */
export interface ToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

/**
 * Tool definition interface
 */
export interface ToolDef<S extends ZodType> {
  name: string;
  description: string;
  schema: S;
  execute: (args: z.infer<S>) => Promise<string> | string;
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

/**
 * Convert a string-returning handler to MCP response format with error handling
 */
export function toMcpToolHandler<T>(
  handler: (args: T) => Promise<string> | string,
): (args: T) => Promise<ToolResult> {
  return async (args: T) => {
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
      debug(
        `[MCP] Tool execution error in ${handler.name || "unknown"}:`,
        error,
      );

      // Create detailed error message
      let errorMessage = "";
      if (error instanceof MCPToolError) {
        // Use the formatted error message for MCPToolError
        errorMessage = error.format();
      } else if (error instanceof Error) {
        errorMessage = "Error: " + error.message;
        if (process.env.DEBUG && error.stack) {
          errorMessage += `\n\nStack trace:\n${error.stack}`;
        }
      } else {
        errorMessage = "Error: " + String(error);
      }

      return {
        content: [
          {
            type: "text",
            text: errorMessage,
          },
        ],
        isError: true,
      };
    }
  };
}

/**
 * Create a simple tool definition
 */
export function createTool<S extends ZodType>(tool: ToolDef<S>): ToolDef<S> {
  return tool;
}

/**
 * Configuration file helpers
 */
export interface McpConfig {
  mcpServers?: Record<
    string,
    {
      command: string;
      args: string[];
      env?: Record<string, string>;
    }
  >;
}

export interface ClaudeSettings {
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
}

/**
 * Read JSON file safely
 */
export function readJsonFile(filePath: string): unknown {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`Error parsing ${filePath}: ${e}`);
  }
}

/**
 * Write JSON file
 */
export function writeJsonFile(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Merge arrays without duplicates
 */
export function mergeArrays<T>(
  existing: T[] | undefined,
  additions: T[] | undefined,
): T[] {
  const existingArray = existing || [];
  const additionsArray = additions || [];
  return [...existingArray, ...additionsArray].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );
}

/**
 * Generate MCP permission names from tool definitions
 * @param serverName The name of the MCP server (used as prefix)
 * @param tools Array of tool definitions
 * @returns Array of permission strings in the format "mcp__<serverName>__<toolName>"
 */
export function generatePermissions(
  serverName: string,
  tools: ToolDef<ZodType>[],
): string[] {
  return tools.map((tool) => `mcp__${serverName}__${tool.name}`);
}

// Tests
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  const { z } = await import("zod");

  describe("toMcpToolHandler", () => {
    it("should convert string to MCP format when no error occurs", async () => {
      const handler = toMcpToolHandler(() => {
        return "Success message";
      });

      const result = await handler({});
      expect(result).toEqual({
        content: [{ type: "text", text: "Success message" }],
      });
    });

    it("should catch and format errors", async () => {
      const handler = toMcpToolHandler(() => {
        throw new Error("Test error message");
      });

      const result = await handler({});
      expect(result).toEqual({
        content: [{ type: "text", text: "Error: Test error message" }],
        isError: true,
      });
    });

    it("should handle non-Error thrown values", async () => {
      const handler = toMcpToolHandler(() => {
        throw "String error";
      });

      const result = await handler({});
      expect(result).toEqual({
        content: [{ type: "text", text: "Error: String error" }],
        isError: true,
      });
    });
  });

  describe("mergeArrays", () => {
    it("should merge arrays without duplicates", () => {
      const result = mergeArrays([1, 2, 3], [3, 4, 5]);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it("should handle empty arrays", () => {
      expect(mergeArrays([], [1, 2])).toEqual([1, 2]);
      expect(mergeArrays([1, 2], [])).toEqual([1, 2]);
      expect(mergeArrays([], [])).toEqual([]);
    });

    it("should handle undefined arrays", () => {
      expect(mergeArrays(undefined, [1, 2])).toEqual([1, 2]);
      expect(mergeArrays([1, 2], undefined)).toEqual([1, 2]);
      expect(mergeArrays(undefined, undefined)).toEqual([]);
    });
  });

  describe("generatePermissions", () => {
    it("should generate permission names from tool definitions", () => {
      const tools: ToolDef<ZodType>[] = [
        {
          name: "test_tool",
          description: "Test tool",
          schema: z.object({}),
          execute: () => "result",
        },
        {
          name: "another_tool",
          description: "Another tool",
          schema: z.object({}),
          execute: () => "result",
        },
      ];

      const permissions = generatePermissions("myserver", tools);
      expect(permissions).toEqual([
        "mcp__myserver__test_tool",
        "mcp__myserver__another_tool",
      ]);
    });

    it("should handle empty tools array", () => {
      const permissions = generatePermissions("myserver", []);
      expect(permissions).toEqual([]);
    });
  });

  describe("createTool", () => {
    it("should return the tool definition as-is", () => {
      const tool: ToolDef<any> = {
        name: "my_tool",
        description: "My tool",
        schema: z.object({ value: z.number() }),
        execute: (args) => `Value: ${args.value}`,
      };

      const result = createTool(tool);
      expect(result).toBe(tool);
    });
  });

  describe("readJsonFile", () => {
    it("should return null for non-existent file", () => {
      const result = readJsonFile("/non/existent/file.json");
      expect(result).toBe(null);
    });
  });

  // writeJsonFile and initializeMcpConfig tests would require fs mocking
}
