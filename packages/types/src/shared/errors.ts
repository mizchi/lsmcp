// Error types and utilities

export class LSMCPError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any,
  ) {
    super(message);
    this.name = "LSMCPError";
  }
}

export class LSPClientError extends LSMCPError {
  constructor(message: string, details?: any) {
    super(message, "LSP_CLIENT_ERROR", details);
    this.name = "LSPClientError";
  }
}

export class FileSystemError extends LSMCPError {
  constructor(
    message: string,
    public path?: string,
    details?: any,
  ) {
    super(message, "FILESYSTEM_ERROR", { path, ...details });
    this.name = "FileSystemError";
  }
}

export class IndexingError extends LSMCPError {
  constructor(
    message: string,
    public file?: string,
    details?: any,
  ) {
    super(message, "INDEXING_ERROR", { file, ...details });
    this.name = "IndexingError";
  }
}

export class ValidationError extends LSMCPError {
  constructor(
    message: string,
    public field?: string,
    details?: any,
  ) {
    super(message, "VALIDATION_ERROR", { field, ...details });
    this.name = "ValidationError";
  }
}

export class TimeoutError extends LSMCPError {
  constructor(
    message: string,
    public timeout: number,
    details?: any,
  ) {
    super(message, "TIMEOUT_ERROR", { timeout, ...details });
    this.name = "TimeoutError";
  }
}

// Error utilities
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

export function isErrorWithCode(
  error: unknown,
): error is Error & { code: string | number } {
  return error instanceof Error && "code" in error;
}

export function formatError(error: unknown, context?: any): string {
  const message = getErrorMessage(error);
  if (!context) return message;

  const contextStr =
    typeof context === "string" ? context : JSON.stringify(context, null, 2);

  return `${message}\nContext: ${contextStr}`;
}
