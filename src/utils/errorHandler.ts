import { debug } from "./mcpHelpers.ts";
import {
  LSMCPError,
  ErrorCode,
  type ErrorContext,
  errors,
} from "../domain/errors/index.ts";

export type { ErrorContext };

export function formatError(error: unknown, context?: ErrorContext): string {
  if (error instanceof LSMCPError) {
    return error.format();
  }

  if (error instanceof Error) {
    const lsmcpError = handleKnownError(error, context);
    if (lsmcpError) {
      return lsmcpError.format();
    }

    // Unknown error
    return errors
      .generic(error.message, ErrorCode.UNKNOWN_ERROR, context)
      .format();
  }

  return String(error);
}

function handleKnownError(
  error: Error,
  context?: ErrorContext,
): LSMCPError | null {
  const message = error.message.toLowerCase();

  // LSP server not found (but not file not found)
  if (
    (message.includes("command not found") || message.includes("enoent")) &&
    !context?.filePath
  ) {
    const language = context?.language || "unknown";
    return errors.lspStartError(language, "Command not found", context);
  }

  // LSP server startup failed
  if (
    message.includes("lsp server exited") ||
    message.includes("failed to start")
  ) {
    const language = context?.language || "unknown";
    return errors.lspStartError(language, error.message, context);
  }

  // File not found
  if (
    message.includes("enoent") ||
    message.includes("no such file") ||
    message.includes("file not found")
  ) {
    const filePath = context?.filePath || "unknown";
    return errors.fileNotFound(filePath, context);
  }

  // Symbol not found
  if (
    message.includes("symbol not found") ||
    message.includes("could not find symbol")
  ) {
    const symbolName = context?.symbolName || "unknown";
    return errors.symbolNotFound(symbolName, context?.line, context);
  }

  // TypeScript project errors
  if (
    message.includes("no tsconfig") ||
    message.includes("typescript project")
  ) {
    return errors.noTsConfig(context);
  }

  // Tool not supported
  if (message.includes("not supported") || message.includes("not available")) {
    const language = context?.language || "unknown";
    const operation = context?.operation || "operation";
    return errors.operationNotSupported(operation, language, context);
  }

  // Timeout errors
  if (message.includes("timeout") || message.includes("timed out")) {
    return errors.timeout(context?.operation || "unknown", context);
  }

  // Permission errors
  if (message.includes("permission denied") || message.includes("eacces")) {
    const filePath = context?.filePath || "unknown";
    return errors.filePermission(filePath, context);
  }

  return null;
}

export function debugLog(message: string, ...args: unknown[]): void {
  if (process.env.DEBUG) {
    debug(`[DEBUG] ${message}`, ...args);
  }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("errorHandler", () => {
    describe("formatError", () => {
      it("should format LSP server not found error", () => {
        const error = new Error("command not found: rust-analyzer");
        const context: ErrorContext = {
          operation: "LSP startup",
          language: "rust",
        };

        const formatted = formatError(error, context);
        expect(formatted).toContain("Failed to start rust language server");
        expect(formatted).toContain("rustup component add rust-analyzer");
      });

      it("should format file not found error", () => {
        const error = new Error("ENOENT: no such file or directory");
        const context: ErrorContext = {
          operation: "file read",
          filePath: "src/test.ts",
        };

        const formatted = formatError(error, context);
        expect(formatted).toContain("File not found: src/test.ts");
        expect(formatted).toContain("Check if the file path is correct");
      });

      it("should format symbol not found error", () => {
        const error = new Error("Could not find symbol 'foo'");
        const context: ErrorContext = {
          operation: "find references",
          symbolName: "foo",
        };

        const formatted = formatError(error, context);
        expect(formatted).toContain('Symbol "foo" not found');
        expect(formatted).toContain("spelled correctly");
      });

      it("should format timeout error", () => {
        const error = new Error("Operation timed out");
        const formatted = formatError(error);

        expect(formatted).toContain("Operation timed out");
        expect(formatted).toContain("Try again");
      });

      it("should format unknown error with debug info when DEBUG is set", () => {
        process.env.DEBUG = "true";
        const error = new Error("Unknown error");
        const formatted = formatError(error);

        expect(formatted).toContain("Unknown error");
        expect(formatted).toContain("Error: Unknown error");

        delete process.env.DEBUG;
      });
    });

    describe("LSMCPError", () => {
      it("should format error with all fields", () => {
        const error = new LSMCPError(
          ErrorCode.UNKNOWN_ERROR,
          "Test Error",
          {
            operation: "test",
          },
          ["Try this fix"],
        );

        const str = error.format();
        expect(str).toContain("Test Error");
        expect(str).toContain("Code: UNKNOWN_ERROR");
        expect(str).toContain("Try this fix");
      });
    });
  });
}
