import { z, type ZodType } from "zod";
import type { Result } from "neverthrow";
import type { ToolDef } from "../../mcp/utils/mcpHelpers.ts";
import { errors } from "../pure/errors/index.ts";

/**
 * Options for creating a tool with the factory
 */
export interface CreateToolOptions<TSchema extends ZodType, TSuccess> {
  /** Tool name as it appears in MCP */
  name: string;

  /** Tool description */
  description: string;

  /** Zod schema for input validation */
  schema: TSchema;

  /** Main handler function that implements the tool logic */
  handler: (args: z.infer<TSchema>) => Promise<Result<TSuccess, string>>;

  /** Function to format success result into a string */
  formatSuccess: (result: TSuccess) => string;

  /** Optional error formatter for custom error handling */
  formatError?: (error: string, args: z.infer<TSchema>) => Error;
}

/**
 * Factory function for creating MCP tools with consistent structure
 *
 * @example
 * ```typescript
 * export const myTool = createTool({
 *   name: "my_tool",
 *   description: "Does something useful",
 *   schema: z.object({ root: z.string() }),
 *   handler: async (args) => {
 *     // Tool implementation
 *     return ok({ message: "Success" });
 *   },
 *   formatSuccess: (result) => result.message,
 * });
 * ```
 */
export function createTool<TSchema extends ZodType, TSuccess>(
  options: CreateToolOptions<TSchema, TSuccess>,
): ToolDef<TSchema> {
  const { name, description, schema, handler, formatSuccess, formatError } =
    options;

  return {
    name,
    description,
    schema,
    execute: async (args: z.infer<TSchema>) => {
      try {
        const result = await handler(args);

        if (result.isOk()) {
          return formatSuccess(result.value);
        } else {
          // Use custom error formatter if provided
          if (formatError) {
            throw formatError(result.error, args);
          }

          // Default to generic error
          throw errors.generic(result.error, undefined, {
            operation: name,
            details: args,
          });
        }
      } catch (error) {
        // Re-throw if already formatted
        if (error instanceof Error) {
          throw error;
        }

        // Wrap unknown errors
        throw errors.generic(String(error), undefined, {
          operation: name,
          details: args,
        });
      }
    },
  };
}

/**
 * Specialized factory for LSP-based tools
 */
export interface CreateLSPToolOptions<TSchema extends ZodType, TSuccess>
  extends Omit<CreateToolOptions<TSchema, TSuccess>, "formatError"> {
  /** Language ID for error context */
  language?: string;
}

/**
 * Factory function for creating LSP-based tools with language-aware error handling
 */
export function createLSPTool<TSchema extends ZodType, TSuccess>(
  options: CreateLSPToolOptions<TSchema, TSuccess>,
): ToolDef<TSchema> {
  const { language = "unknown", ...rest } = options;

  return createTool({
    ...rest,
    formatError: (error: string, args: any) => {
      // Check for common LSP errors
      if (error.includes("not running") || error.includes("not initialized")) {
        return errors.lspNotRunning(language, {
          operation: rest.name,
          language,
          filePath: args.filePath,
        });
      }

      if (error.includes("timeout") || error.includes("timed out")) {
        return errors.timeout(rest.name, {
          operation: rest.name,
          language,
          filePath: args.filePath,
        });
      }

      // Default to generic error with language context
      return errors.generic(error, undefined, {
        operation: rest.name,
        language,
        filePath: args.filePath,
      });
    },
  });
}
