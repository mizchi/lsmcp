/**
 * Error handling utilities
 */

/**
 * Type guard to check if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Type guard to check if a value is an Error instance
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard to check if an error has a message property
 */
export function isErrorWithMessage(
  error: unknown,
): error is { message: string } {
  return isObject(error) && typeof (error as any).message === "string";
}

/**
 * Safe error message extraction
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return String(error);
}
