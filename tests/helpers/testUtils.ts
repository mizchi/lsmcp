/**
 * Test utilities for DI-based unit tests without vi.mock
 * - InMemoryFileSystem implements FileSystem
 * - TestSymbolProvider implements SymbolProvider
 * - createTestExecutionContext to seed context for getOrCreateIndex or direct SymbolIndex usage
 */

import type { SymbolProvider } from "@lsmcp/code-indexer";
import type { FileSystemApi } from "@lsmcp/types";
import {
  SymbolKind,
  type DocumentSymbol,
  type Range,
} from "vscode-languageserver-types";

/**
 * In-memory FileSystem implementation for tests
 * Matches the minimal FileSystem interface
 *   readFile(path: string): Promise<string>
 *   exists(path: string): Promise<boolean>
 *   stat(path: string): Promise<{ mtime: Date }>
 */
export class InMemoryFileSystem implements FileSystemApi {
  private files = new Map<string, { content: string; mtime: Date }>();

  constructor(seed?: Record<string, string>) {
    if (seed) {
      for (const [p, c] of Object.entries(seed)) {
        this.setFile(p, c);
      }
    }
  }

  normalizePath(p: string): string {
    // Keep simple normalization to avoid introducing path dependency
    // Ensure no trailing spaces and unify separators to forward slashes for map identity
    return p.replace(/\\\\/g, "/").trim();
  }

  setFile(path: string, content: string): void {
    const p = this.normalizePath(path);
    this.files.set(p, { content, mtime: new Date() });
  }

  removeFile(path: string): void {
    const p = this.normalizePath(path);
    this.files.delete(p);
  }

  touch(path: string): void {
    const p = this.normalizePath(path);
    const entry = this.files.get(p);
    if (entry) {
      entry.mtime = new Date();
      this.files.set(p, entry);
    }
  }

  async readFile(path: string): Promise<string> {
    const p = this.normalizePath(path);
    const entry = this.files.get(p);
    if (!entry) {
      throw new Error(`File not found in InMemoryFileSystem: ${p}`);
    }
    return entry.content;
  }

  async writeFile(
    path: string,
    data: string | Buffer,
    encoding?: BufferEncoding,
  ): Promise<void> {
    const p = this.normalizePath(path);
    const content =
      typeof data === "string" ? data : data.toString(encoding || "utf-8");
    this.setFile(p, content);
  }

  async readdir(path: string, _options?: any): Promise<any> {
    const p = this.normalizePath(path);
    const files = Array.from(this.files.keys())
      .filter(
        (f) => f.startsWith(p + "/") && !f.slice(p.length + 1).includes("/"),
      )
      .map((f) => f.slice(p.length + 1));
    return files;
  }

  async exists(path: string): Promise<boolean> {
    const p = this.normalizePath(path);
    return this.files.has(p);
  }

  async stat(path: string): Promise<any> {
    const p = this.normalizePath(path);
    const entry = this.files.get(p);
    if (!entry) {
      throw new Error(`File not found in InMemoryFileSystem: ${p}`);
    }
    return {
      mtime: entry.mtime,
      isFile: () => true,
      isDirectory: () => false,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isSymbolicLink: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      size: entry.content.length,
    };
  }

  async lstat(path: string): Promise<any> {
    return this.stat(path);
  }

  async mkdir(
    _path: string,
    _options?: { recursive?: boolean },
  ): Promise<string | undefined> {
    return undefined;
  }

  async rm(
    path: string,
    _options?: { recursive?: boolean; force?: boolean },
  ): Promise<void> {
    const p = this.normalizePath(path);
    this.files.delete(p);
  }

  async realpath(path: string): Promise<string> {
    return this.normalizePath(path);
  }

  async cwd(): Promise<string> {
    return "/";
  }

  async resolve(...paths: string[]): Promise<string> {
    return paths.join("/");
  }

  async isDirectory(_path: string): Promise<boolean> {
    return false;
  }

  async listDirectory(path: string): Promise<string[]> {
    return this.readdir(path);
  }
}

/**
 * Very small helper to build a DocumentSymbol range
 */
export function makeRange(
  startLine = 0,
  startChar = 0,
  endLine = 0,
  endChar = 1,
): Range {
  return {
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
  };
}

/**
 * TestSymbolProvider allows tests to inject expected symbols per URI.
 * It returns DocumentSymbol[] by default, which SymbolIndex can consume.
 */
export class TestSymbolProvider implements SymbolProvider {
  private symbolsByUri = new Map<string, DocumentSymbol[]>();

  constructor(seed?: Record<string, DocumentSymbol[]>) {
    if (seed) {
      for (const [uri, symbols] of Object.entries(seed)) {
        this.setSymbols(uri, symbols);
      }
    }
  }

  setSymbols(uri: string, symbols: DocumentSymbol[]): void {
    this.symbolsByUri.set(uri, symbols);
  }

  clear(): void {
    this.symbolsByUri.clear();
  }

  async getDocumentSymbols(uri: string): Promise<any[]> {
    return this.symbolsByUri.get(uri) ?? [];
  }

  /**
   * Convenience: add a simple top-level symbol by name and kind
   */
  addSimpleSymbol(
    uri: string,
    name: string,
    kind: SymbolKind = SymbolKind.Function,
  ): void {
    const list = this.symbolsByUri.get(uri) ?? [];
    list.push({
      name,
      kind,
      range: makeRange(0, 0, 0, Math.max(1, name.length)),
      selectionRange: makeRange(0, 0, 0, Math.max(1, name.length)),
    });
    this.symbolsByUri.set(uri, list);
  }
}

/**
 * Context type used by getOrCreateIndex in tests
 * You can pass this object directly as "context" parameter.
 */
export interface TestExecutionContext {
  fileSystem: InMemoryFileSystem;
  symbolProvider: TestSymbolProvider;
  // Explicitly no lspClient for unit tests
}

/**
 * Create a test execution context with seeded files and symbols.
 * - files: Record of absolute or relative file system paths to content
 * - symbols: Record of file URI string to DocumentSymbol[]
 *
 * Note: SymbolIndex expects getDocumentSymbols to receive a file URI (file://...)
 * The caller should prepare URIs accordingly if needed.
 */
export function createTestExecutionContext(params?: {
  files?: Record<string, string>;
  symbols?: Record<string, DocumentSymbol[]>;
}): TestExecutionContext {
  const fileSystem = new InMemoryFileSystem(params?.files);
  const symbolProvider = new TestSymbolProvider(params?.symbols);
  return { fileSystem, symbolProvider };
}
