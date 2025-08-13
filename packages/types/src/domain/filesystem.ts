// File system domain types

import type { Stats } from "node:fs";

/**
 * Async file system API interface
 */
export interface FileSystemApi {
  // Overloaded readFile methods
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  readFile(path: string): Promise<Buffer>;

  writeFile(
    path: string,
    data: string | Buffer,
    encoding?: BufferEncoding,
  ): Promise<void>;

  // Overloaded readdir methods
  readdir(path: string): Promise<string[]>;
  readdir(path: string, options: { withFileTypes: true }): Promise<any[]>;
  readdir(
    path: string,
    options?: { withFileTypes?: boolean },
  ): Promise<string[] | any[]>;

  stat(path: string): Promise<Stats>;
  lstat(path: string): Promise<Stats>;
  exists(path: string): Promise<boolean>;
  mkdir(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<string | undefined>;
  rm(
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ): Promise<void>;
  realpath(path: string): Promise<string>;
  
  // Path utilities
  cwd(): Promise<string>;
  resolve(...paths: string[]): Promise<string>;
}

/**
 * Extended file system API with additional utility methods
 */
export interface ExtendedFileSystemApi extends FileSystemApi {
  // Additional utility methods
  readFileMaybe(path: string): Promise<string | null>;
  readJSON<T = any>(path: string): Promise<T>;
  writeJSON(
    path: string,
    data: any,
    options?: { spaces?: number },
  ): Promise<void>;
  copy(
    src: string,
    dest: string,
    options?: { recursive?: boolean },
  ): Promise<void>;
  move(src: string, dest: string): Promise<void>;
  ensureDir(path: string): Promise<void>;
  emptyDir(path: string): Promise<void>;
  pathExists(path: string): Promise<boolean>;
  isFile(path: string): Promise<boolean>;
  isDirectory(path: string): Promise<boolean>;
  getSize(path: string): Promise<number>;
}

export interface FileResolutionResult {
  /**
   * The absolute path to the resolved file
   */
  filePath: string;

  /**
   * The content of the file
   */
  content: string;

  /**
   * Optional metadata about the resolution
   */
  metadata?: {
    isSymlink?: boolean;
    resolvedFrom?: string;
    encoding?: string;
  };
}

export interface FileLineResolutionResult extends FileResolutionResult {
  /**
   * The resolved line number (1-based)
   */
  line: number;

  /**
   * The content of the specific line
   */
  lineContent: string;

  /**
   * Optional character position in the line (0-based)
   */
  character?: number;
}

export interface FileSymbolResolutionResult extends FileLineResolutionResult {
  /**
   * The name of the resolved symbol
   */
  symbolName: string;

  /**
   * The type/kind of the symbol
   */
  symbolKind?: string;

  /**
   * The full qualified name of the symbol
   */
  qualifiedName?: string;

  /**
   * The container/parent of the symbol
   */
  containerName?: string;
}
