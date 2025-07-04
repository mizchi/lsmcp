import { resolveLineParameter } from "../../core/textUtils/resolveLineParameter.ts";
import { ErrorContext, formatError } from "../../mcp/utils/errorHandler.ts";

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
  const resolveResult = resolveLineParameter(content, line);

  if (!resolveResult.success) {
    const context: ErrorContext = {
      operation: "line resolution",
      filePath,
      details: { line, error: resolveResult.error },
    };
    throw new Error(
      formatError(
        new Error(`Failed to resolve line: ${resolveResult.error}`),
        context,
      ),
    );
  }

  return resolveResult.lineIndex;
}
