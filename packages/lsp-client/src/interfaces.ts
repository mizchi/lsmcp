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

// File system interface
export interface IFileSystem {
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  writeFile(
    path: string,
    data: string,
    encoding?: BufferEncoding,
  ): Promise<void>;
  readdir(path: string): Promise<string[]>;
  stat(path: string): Promise<any>;
  exists(path: string): Promise<boolean>;
  isDirectory(path: string): Promise<boolean>;
  listDirectory(path: string): Promise<string[]>;
}

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

// LSP Adapter interface
export interface ILspAdapter {
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
