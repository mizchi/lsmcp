/**
 * Unified error system for LSMCP
 */

/**
 * Error codes for categorizing errors
 */
export enum ErrorCode {
  // File system errors
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  FILE_READ_ERROR = "FILE_READ_ERROR",
  FILE_WRITE_ERROR = "FILE_WRITE_ERROR",
  PERMISSION_DENIED = "PERMISSION_DENIED",

  // LSP errors
  LSP_NOT_RUNNING = "LSP_NOT_RUNNING",
  LSP_START_ERROR = "LSP_START_ERROR",
  LSP_TIMEOUT = "LSP_TIMEOUT",
  LSP_COMMUNICATION_ERROR = "LSP_COMMUNICATION_ERROR",
  LSP_NOT_SUPPORTED = "LSP_NOT_SUPPORTED",

  // Symbol/Code errors
  SYMBOL_NOT_FOUND = "SYMBOL_NOT_FOUND",
  LINE_NOT_FOUND = "LINE_NOT_FOUND",
  INVALID_LINE_NUMBER = "INVALID_LINE_NUMBER",
  INVALID_POSITION = "INVALID_POSITION",

  // Tool errors
  TOOL_NOT_FOUND = "TOOL_NOT_FOUND",
  PARAMETER_REQUIRED = "PARAMETER_REQUIRED",
  INVALID_PARAMETER = "INVALID_PARAMETER",

  // Response errors
  RESPONSE_TOO_LARGE = "RESPONSE_TOO_LARGE",
  NO_RESULTS = "NO_RESULTS",

  // Project errors
  PROJECT_CONFIG_ERROR = "PROJECT_CONFIG_ERROR",
  NO_TSCONFIG = "NO_TSCONFIG",

  // Generic errors
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  OPERATION_FAILED = "OPERATION_FAILED",
}

/**
 * Error context for debugging and better error messages
 */
export interface ErrorContext {
  operation?: string;
  language?: string;
  filePath?: string;
  symbolName?: string;
  line?: number | string;
  details?: Record<string, unknown>;
}

/**
 * Unified error class for LSMCP
 */
export class LSMCPError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly context?: ErrorContext,
    public readonly suggestions?: string[],
    public readonly relatedTools?: string[],
  ) {
    super(message);
    this.name = "LSMCPError";
  }

  /**
   * Format the error for user display
   */
  format(): string {
    let result = `❌ Error: ${this.message}`;
    result += `\n   Code: ${this.code}`;

    // Add context information
    if (this.context) {
      if (this.context.filePath) {
        result += `\n   File: ${this.context.filePath}`;
      }
      if (this.context.line !== undefined) {
        result += `\n   Line: ${this.context.line}`;
      }
      if (this.context.symbolName) {
        result += `\n   Symbol: ${this.context.symbolName}`;
      }
    }

    // Add suggestions
    if (this.suggestions && this.suggestions.length > 0) {
      result += "\n\n💡 Suggestions:";
      this.suggestions.forEach((suggestion) => {
        result += `\n   • ${suggestion}`;
      });
    }

    // Add related tools
    if (this.relatedTools && this.relatedTools.length > 0) {
      result += "\n\n🔧 Alternative tools you can try:";
      this.relatedTools.forEach((tool) => {
        result += `\n   • ${tool}`;
      });
    }

    // Add debug info if available
    if (process.env.DEBUG && this.stack) {
      result += "\n\n🐛 Debug info:";
      result += `\n${this.stack}`;
    }

    return result;
  }

  /**
   * Convert to plain string
   */
  toString(): string {
    return this.format();
  }

  /**
   * Check if error is of specific type
   */
  is(code: ErrorCode): boolean {
    return this.code === code;
  }
}

/**
 * Error factory functions for common scenarios
 */
/**
 * Type guard to check if a code is valid ErrorCode
 */
function isErrorCode(code: string): code is ErrorCode {
  return Object.values(ErrorCode).includes(code as ErrorCode);
}

export const errors = {
  fileNotFound: (filePath: string, context?: ErrorContext) =>
    new LSMCPError(
      ErrorCode.FILE_NOT_FOUND,
      `File not found: ${filePath}`,
      { ...context, filePath },
      [
        "Check if the file path is correct and relative to the root directory",
        "Use forward slashes (/) for path separators",
        "Make sure the file exists in the project",
      ],
    ),

  fileRead: (filePath: string, error: string, context?: ErrorContext) =>
    new LSMCPError(
      ErrorCode.FILE_READ_ERROR,
      `Failed to read file ${filePath}: ${error}`,
      { ...context, filePath },
      [
        "Check if the file exists and is readable",
        "Verify file permissions",
        "Ensure the file is not corrupted",
      ],
    ),

  fileWrite: (filePath: string, error: string, context?: ErrorContext) =>
    new LSMCPError(
      ErrorCode.FILE_WRITE_ERROR,
      `Failed to write file ${filePath}: ${error}`,
      { ...context, filePath },
      [
        "Check if the directory exists and is writable",
        "Verify file permissions",
        "Ensure there is enough disk space",
      ],
    ),

  filePermission: (filePath: string, context?: ErrorContext) =>
    new LSMCPError(
      ErrorCode.PERMISSION_DENIED,
      `Permission denied: ${filePath}`,
      { ...context, filePath },
      [
        "Check file permissions",
        "Ensure you have read/write access to the file",
        "Try running with appropriate permissions",
      ],
    ),

  symbolNotFound: (
    symbol: string,
    line?: number | string,
    context?: ErrorContext,
  ) =>
    new LSMCPError(
      ErrorCode.SYMBOL_NOT_FOUND,
      `Symbol "${symbol}" not found${line ? ` on line ${line}` : ""}`,
      { ...context, symbolName: symbol, line },
      [
        "Check if the symbol name is spelled correctly",
        "The symbol might be on a different line",
        "Use find_references to search for the symbol across the entire file",
      ],
      ["find_references", "get_workspace_symbols"],
    ),

  lineNotFound: (
    line: string | number,
    filePath: string,
    context?: ErrorContext,
  ) =>
    new LSMCPError(
      ErrorCode.LINE_NOT_FOUND,
      typeof line === "string"
        ? `Line containing "${line}" not found in ${filePath}`
        : `Line ${line} not found in ${filePath}`,
      { ...context, line, filePath },
      [
        "Check if the line number is correct (1-based)",
        "For string search, ensure the text exists in the file",
        "Use get_document_symbols to see the file structure",
      ],
    ),

  lspNotRunning: (language: string = "unknown", context?: ErrorContext) =>
    new LSMCPError(
      ErrorCode.LSP_NOT_RUNNING,
      `LSP server for ${language} is not running or not initialized`,
      { ...context, language },
      [
        `Make sure the ${language} language server is installed`,
        "Check if the LSP server process is running",
        "Try restarting the MCP server",
      ],
      getAlternativeTools(language),
    ),

  lspStartError: (language: string, error: string, context?: ErrorContext) =>
    new LSMCPError(
      ErrorCode.LSP_START_ERROR,
      `Failed to start ${language} language server: ${error}`,
      { ...context, language },
      [
        `Check if the ${language} language server is installed correctly`,
        "Try running the language server command manually to diagnose issues",
        `Install command: ${getLSPInstallCommand(language)}`,
      ],
    ),

  responseTooLarge: (size: number, limit: number, context?: ErrorContext) =>
    new LSMCPError(
      ErrorCode.RESPONSE_TOO_LARGE,
      `Response size (${size} tokens) exceeds limit (${limit} tokens)`,
      context,
      [
        "Use filters to reduce the response size",
        "Specify a more targeted search query",
        "Use pagination parameters if available",
        "Try searching in a specific directory instead of the whole project",
      ],
    ),

  parameterRequired: (
    param: string,
    description?: string,
    context?: ErrorContext,
  ) =>
    new LSMCPError(
      ErrorCode.PARAMETER_REQUIRED,
      `Required parameter missing: ${param}`,
      context,
      [
        description || `The ${param} parameter is required for this tool`,
        "Check the tool schema for required parameters",
        "Use list_tools to see tool descriptions",
      ],
    ),

  timeout: (operation: string, context?: ErrorContext) =>
    new LSMCPError(
      ErrorCode.LSP_TIMEOUT,
      `Operation timed out: ${operation}`,
      { ...context, operation },
      [
        "Try again - the server might be busy",
        "If the problem persists, restart the language server",
        "Consider increasing the timeout value",
      ],
    ),

  noTsConfig: (context?: ErrorContext) =>
    new LSMCPError(
      ErrorCode.NO_TSCONFIG,
      "TypeScript project configuration not found",
      context,
      [
        "Ensure tsconfig.json exists in the project root or a parent directory",
        "Run 'tsc --init' to create a default configuration",
        "Check if the project root is set correctly",
      ],
    ),

  operationNotSupported: (
    operation: string,
    language: string,
    context?: ErrorContext,
  ) =>
    new LSMCPError(
      ErrorCode.LSP_NOT_SUPPORTED,
      `Operation "${operation}" is not supported for ${language}`,
      { ...context, operation, language },
      [
        `The ${language} language server does not support this feature`,
        "Check the language server documentation for supported features",
        "Try using alternative tools for similar functionality",
      ],
      getAlternativeTools(language),
    ),

  generic: (
    message: string,
    code?: string | ErrorCode,
    context?: ErrorContext,
  ) => {
    const errorCode =
      code && isErrorCode(code) ? code : ErrorCode.UNKNOWN_ERROR;
    return new LSMCPError(errorCode, message, context);
  },
};

/**
 * Helper function to get LSP install command
 */
function getLSPInstallCommand(language: string): string {
  const commands: Record<string, string> = {
    typescript: "npm install -g typescript typescript-language-server",
    javascript: "npm install -g typescript typescript-language-server",
    python: "pip install python-lsp-server[all]",
    rust: "rustup component add rust-analyzer",
    go: "go install golang.org/x/tools/gopls@latest",
    java: "Download from https://download.eclipse.org/jdtls/",
    "c++": "Install clangd from https://clangd.llvm.org/installation",
    c: "Install clangd from https://clangd.llvm.org/installation",
    ruby: "gem install solargraph",
    fsharp: "dotnet tool install --global fsautocomplete",
    moonbit: "moon update && moon install",
  };

  return (
    commands[language.toLowerCase()] ||
    `Check the documentation for ${language} language server installation`
  );
}

/**
 * Get alternative tools for a language
 */
function getAlternativeTools(language: string): string[] {
  if (language === "typescript" || language === "javascript") {
    return [
      "Use non-LSP TypeScript tools if available",
      "Try generic text search tools",
    ];
  }
  return ["Use generic text search and navigation tools"];
}

/**
 * Convert unknown errors to LSMCPError
 */
export function normalizeError(
  error: unknown,
  context?: ErrorContext,
): LSMCPError {
  if (error instanceof LSMCPError) {
    return error;
  }

  if (error instanceof Error) {
    // Try to detect known error patterns
    const message = error.message.toLowerCase();

    if (message.includes("enoent") || message.includes("no such file")) {
      const filePath = context?.filePath || "unknown";
      return errors.fileNotFound(filePath, context);
    }

    if (message.includes("timeout") || message.includes("timed out")) {
      return errors.timeout(context?.operation || "unknown", context);
    }

    if (
      message.includes("symbol not found") ||
      message.includes("could not find symbol")
    ) {
      const symbol = context?.symbolName || "unknown";
      return errors.symbolNotFound(symbol, context?.line, context);
    }

    if (message.includes("no tsconfig")) {
      return errors.noTsConfig(context);
    }

    // Default to generic error
    return errors.generic(error.message, ErrorCode.UNKNOWN_ERROR, context);
  }

  // Non-Error values
  return errors.generic(String(error), ErrorCode.UNKNOWN_ERROR, context);
}

/**
 * Wrap an async operation with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw normalizeError(error, context);
  }
}

/**
 * Create an error handler with context
 */
export function createErrorHandler(baseContext: ErrorContext) {
  return (error: unknown): never => {
    throw normalizeError(error, baseContext);
  };
}
