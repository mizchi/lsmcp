/**
 * Interfaces for dependency injection - following Dependency Inversion Principle
 */

// Logger interface
export interface ILogger {
  debug(...args: any[]): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

// Error handling interface
export interface IErrorHandler {
  formatError(error: any, context?: Record<string, any>): string;
}

// Re-export FileSystemApi as IFileSystem for backward compatibility
export type { FileSystemApi as IFileSystem } from "@lsmcp/types";

// Language detection interface
export interface ILanguageDetector {
  getLanguageId(filePath: string): string | null;
}

// Line resolver interface
export interface ILineResolver {
  resolveLineParameter(lines: string[], line: string | number): number;
}

// Server characteristics interface
export interface IServerCharacteristics {
  documentOpenDelay: number;
  operationTimeout: number;
  supportsIncrementalSync?: boolean;
  supportsPullDiagnostics?: boolean;
}

export interface IServerCharacteristicsProvider {
  getCharacteristics(
    languageId: string,
    overrides?: Partial<IServerCharacteristics>,
  ): IServerCharacteristics;
}

// LSP Client Config interface
export interface ILspClientConfig {
  id: string;
  name: string;
  command: string[];
  baseLanguage: string;
  bin: string; // Required for spawn
  args?: string[];
  initializationOptions?: any;
  serverCharacteristics?: IServerCharacteristics;
  doctor?: () => Promise<{ ok: boolean; message?: string }>;
  unsupported?: string[]; // List of unsupported LSP features
}

// Result builder interface
export interface IDiagnosticResultBuilder {
  build(): any;
}
