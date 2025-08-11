/**
 * Default implementations of interfaces
 */

import type {
  ILogger,
  IErrorHandler,
  ILanguageDetector,
  ILineResolver,
  IServerCharacteristicsProvider,
  IServerCharacteristics,
} from "../interfaces/index.ts";

// Default logger (no-op)
export class DefaultLogger implements ILogger {
  debug(..._args: any[]): void {
    // No-op by default
  }
  info(..._args: any[]): void {
    // No-op by default
  }
  warn(..._args: any[]): void {
    // No-op by default
  }
  error(..._args: any[]): void {
    // No-op by default
  }
}

// Console logger for debugging
export class ConsoleLogger implements ILogger {
  debug(...args: any[]): void {
    console.debug(...args);
  }
  info(...args: any[]): void {
    console.info(...args);
  }
  warn(...args: any[]): void {
    console.warn(...args);
  }
  error(...args: any[]): void {
    console.error(...args);
  }
}

// Default error handler
export class DefaultErrorHandler implements IErrorHandler {
  formatError(error: any, context?: Record<string, any>): string {
    const message = error?.message || String(error);
    if (context && Object.keys(context).length > 0) {
      return `${message} (Context: ${JSON.stringify(context)})`;
    }
    return message;
  }
}

// Default language detector
export class DefaultLanguageDetector implements ILanguageDetector {
  private readonly languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    sh: "shellscript",
    yml: "yaml",
    yaml: "yaml",
    json: "json",
    xml: "xml",
    html: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    md: "markdown",
    sql: "sql",
  };

  getLanguageId(filePath: string): string | null {
    const ext = filePath.split(".").pop();
    return this.languageMap[ext || ""] || null;
  }
}

// Default line resolver
export class DefaultLineResolver implements ILineResolver {
  resolveLineParameter(lines: string[], line: string | number): number {
    if (typeof line === "number") {
      return Math.max(0, Math.min(line - 1, lines.length - 1));
    }
    const index = lines.findIndex((l) => l.includes(line));
    if (index === -1) {
      throw new Error(`Line containing "${line}" not found`);
    }
    return index;
  }
}

// Default server characteristics provider
export class DefaultServerCharacteristicsProvider
  implements IServerCharacteristicsProvider
{
  private readonly defaultCharacteristics: IServerCharacteristics = {
    documentOpenDelay: 100,
    operationTimeout: 5000,
    supportsIncrementalSync: true,
    supportsPullDiagnostics: false,
  };

  getCharacteristics(
    _languageId: string,
    overrides?: Partial<IServerCharacteristics>,
  ): IServerCharacteristics {
    return {
      ...this.defaultCharacteristics,
      ...overrides,
    };
  }
}
