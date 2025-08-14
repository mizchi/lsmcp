/**
 * Debug and logging utilities
 */

import { debugLogWithPrefix } from "../../../../src/utils/debugLog.ts";

export function debug(...args: any[]): void {
  // Already handled by debugLogWithPrefix
  debugLogWithPrefix("LSP", ...args);
}

export function debugLog(message: string, data?: any): void {
  // Already handled by debugLogWithPrefix
  debugLogWithPrefix("LSP", message, data ? JSON.stringify(data, null, 2) : "");
}

// Re-export error handling utilities from main utils
export {
  formatError,
  getErrorMessage,
} from "../../../../src/utils/errorHandler.ts";
export type { ErrorContext } from "../../../../src/utils/errorHandler.ts";

export function isErrorWithCode(
  error: unknown,
): error is Error & { code: number } {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as any).code === "number"
  );
}
