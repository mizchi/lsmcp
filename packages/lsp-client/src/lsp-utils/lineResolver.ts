import { resolveLineParameter } from "../utils/container-helpers.ts";
import { ErrorContext, formatError } from "../utils/container-helpers.ts";

/**
 * Resolve a line parameter to a line index, throwing on error
 *
 * @param content - File content
 * @param line - Line number (1-based) or string to search for
 * @param filePath - File path for error context
 * @returns Zero-based line index
 * @throws Error if line cannot be resolved
 */
export function resolveLineIndexOrThrow(
  content: string,
  line: string | number,
  filePath: string,
): number {
  const lines = content.split("\n");

  try {
    const lineIndex = resolveLineParameter(lines, line);
    return lineIndex;
  } catch (error) {
    const context: ErrorContext = {
      operation: "line resolution",
      filePath,
      details: {
        line,
        error: error instanceof Error ? error.message : String(error),
      },
    };
    throw new Error(
      formatError(
        new Error(
          `Failed to resolve line: ${error instanceof Error ? error.message : String(error)}`,
        ),
        context,
      ),
    );
  }
}
