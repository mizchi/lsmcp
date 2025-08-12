/**
 * Debug and logging utilities
 */

export function debug(...args: any[]): void {
  if (process.env.DEBUG) {
    console.error("[LSP]", ...args);
  }
}

export function debugLog(message: string, data?: any): void {
  if (process.env.DEBUG) {
    console.error(
      `[LSP] ${message}`,
      data ? JSON.stringify(data, null, 2) : "",
    );
  }
}

export interface ErrorContext {
  operation: string;
  language?: string;
  details?: Record<string, any>;
}

export function formatError(error: unknown, context?: ErrorContext): string {
  let message = "LSP Error";

  if (context) {
    message += ` during ${context.operation}`;
    if (context.language) {
      message += ` (${context.language})`;
    }
  }

  if (error instanceof Error) {
    message += `: ${error.message}`;
  } else {
    message += `: ${String(error)}`;
  }

  if (context?.details) {
    message += `\nDetails: ${JSON.stringify(context.details, null, 2)}`;
  }

  return message;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function isErrorWithCode(
  error: unknown,
): error is Error & { code: number } {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as any).code === "number"
  );
}
