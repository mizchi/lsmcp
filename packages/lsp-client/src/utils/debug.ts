/**
 * Debug and logging utilities
 *
 * This file provides backward compatibility with existing code
 * while using the new independent LSP logger
 */

import { lspDebug, lspDebugWithPrefix } from "./lsp-logger.ts";

export function debug(...args: any[]): void {
  lspDebug(...args);
}

export function debugLog(message: string, data?: any): void {
  if (data) {
    lspDebugWithPrefix("Debug", message, JSON.stringify(data, null, 2));
  } else {
    lspDebugWithPrefix("Debug", message);
  }
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
