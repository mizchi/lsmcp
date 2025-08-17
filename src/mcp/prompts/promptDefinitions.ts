/**
 * MCP Prompt definitions for lsmcp
 */

import { z } from "zod";
import type { McpContext } from "@internal/types";

/**
 * Interface for MCP prompt definition
 */
export interface McpPromptDef<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema?: S;
  execute: (args: z.infer<S>, context?: McpContext) => Promise<string> | string;
}

/**
 * Prompt result format for MCP SDK
 */
export interface PromptResult {
  [x: string]: unknown;
  description?: string;
  messages: Array<{
    [x: string]: unknown;
    role: "user" | "assistant";
    content: {
      [x: string]: unknown;
      type: "text";
      text: string;
    };
  }>;
}

/**
 * Convert a prompt handler to MCP prompt response format
 */
export function toMcpPromptHandler<T>(
  handler: (args: T, context?: McpContext) => Promise<string> | string,
  description: string,
  context?: McpContext,
): (args: T) => Promise<PromptResult> {
  return async (args: T) => {
    try {
      const content = await handler(args, context);
      return {
        description,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: content,
            },
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        description: `Error in ${description}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Error: ${errorMessage}`,
            },
          },
        ],
      };
    }
  };
}

/**
 * Create a simple prompt definition
 */
export function createPrompt<S extends z.ZodType>(
  prompt: McpPromptDef<S>,
): McpPromptDef<S> {
  return prompt;
}
