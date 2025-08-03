/**
 * Core symbol index implementation
 */

import { EventEmitter } from "events";
import { pathToFileURL } from "url";
import { resolve } from "path";
import type {
  IndexedSymbol,
  FileSymbols,
  SymbolQuery,
  IndexStats,
  SymbolProvider,
  FileSystem,
  SymbolCache,
  IndexEvent,
} from "./types.ts";
import { SymbolKind } from "vscode-languageserver-types";

export class SymbolIndex extends EventEmitter {
  private fileIndex: Map<string, FileSymbols> = new Map();
  private symbolIndex: Map<string, Set<string>> = new Map(); // name -> file URIs
  private kindIndex: Map<SymbolKind, Set<string>> = new Map(); // kind -> file URIs
  private containerIndex: Map<string, Set<string>> = new Map(); // container -> file URIs
  private stats: IndexStats = {
    totalFiles: 0,
    totalSymbols: 0,
    indexingTime: 0,
    lastUpdated: new Date(),
  };

  constructor(
    private rootPath: string,
    private symbolProvider: SymbolProvider,
    private fileSystem: FileSystem,
    private cache?: SymbolCache,
  ) {
    super();
  }

  /**
   * Index a single file
   */
  async indexFile(filePath: string): Promise<void> {
    const absolutePath = resolve(this.rootPath, filePath);
    const uri = pathToFileURL(absolutePath).toString();
    const startTime = Date.now();

    try {
      // Try cache first
      if (this.cache) {
        const cachedSymbols = await this.cache.get(absolutePath);
        if (cachedSymbols) {
          this.storeSymbols(uri, cachedSymbols);
          this.emit("fileIndexed", {
            type: "fileIndexed",
            uri,
            symbolCount: cachedSymbols.length,
            fromCache: true,
          } as IndexEvent);
          return;
        }
      }

      // Read file content
      await this.fileSystem.readFile(absolutePath);

      // Get symbols from provider
      const rawSymbols = await this.symbolProvider.getDocumentSymbols(uri);

      if (!rawSymbols || rawSymbols.length === 0) {
        return;
      }

      // Convert symbols
      const symbols = this.convertSymbols(rawSymbols, uri);

      // Store in index
      this.storeSymbols(uri, symbols);

      // Update cache
      if (this.cache) {
        await this.cache.set(absolutePath, symbols);
      }

      // Update stats
      this.stats.indexingTime += Date.now() - startTime;
      this.stats.lastUpdated = new Date();
      this.updateStats();

      this.emit("fileIndexed", {
        type: "fileIndexed",
        uri,
        symbolCount: symbols.length,
        fromCache: false,
      } as IndexEvent);
    } catch (error) {
      this.emit("indexError", {
        type: "indexError",
        uri,
        error: error instanceof Error ? error : new Error(String(error)),
      } as IndexEvent);
    }
  }

  /**
   * Index multiple files
   */
  async indexFiles(filePaths: string[], concurrency = 5): Promise<void> {
    this.emit("indexingStarted", {
      type: "indexingStarted",
      fileCount: filePaths.length,
    } as IndexEvent);

    const startTime = Date.now();

    // Process in chunks
    for (let i = 0; i < filePaths.length; i += concurrency) {
      const chunk = filePaths.slice(i, i + concurrency);
      await Promise.all(chunk.map((file) => this.indexFile(file)));
    }

    const duration = Date.now() - startTime;
    this.emit("indexingCompleted", {
      type: "indexingCompleted",
      duration,
    } as IndexEvent);
  }

  /**
   * Remove file from index
   */
  removeFile(filePath: string): void {
    const absolutePath = resolve(this.rootPath, filePath);
    const uri = pathToFileURL(absolutePath).toString();

    const fileSymbols = this.fileIndex.get(uri);
    if (!fileSymbols) return;

    // Remove from indices
    this.removeFromIndices(fileSymbols.symbols, uri);

    // Remove from file index
    this.fileIndex.delete(uri);

    this.updateStats();
    this.emit("fileRemoved", {
      type: "fileRemoved",
      uri,
    } as IndexEvent);
  }

  /**
   * Query symbols
   */
  querySymbols(query: SymbolQuery): IndexedSymbol[] {
    let fileUris = new Set<string>();

    // Start with all files if no specific filters
    if (!query.name && !query.kind && !query.file && !query.containerName) {
      fileUris = new Set(this.fileIndex.keys());
    }

    // Filter by name
    if (query.name) {
      const nameUris = this.symbolIndex.get(query.name) || new Set();
      if (fileUris.size === 0) {
        fileUris = new Set(nameUris);
      } else {
        fileUris = new Set([...fileUris].filter((uri) => nameUris.has(uri)));
      }
    }

    // Filter by kind
    if (query.kind) {
      const kinds = Array.isArray(query.kind) ? query.kind : [query.kind];
      const kindUris = new Set<string>();

      for (const kind of kinds) {
        const uris = this.kindIndex.get(kind) || new Set();
        uris.forEach((uri) => kindUris.add(uri));
      }

      if (fileUris.size === 0) {
        fileUris = kindUris;
      } else {
        fileUris = new Set([...fileUris].filter((uri) => kindUris.has(uri)));
      }
    }

    // Filter by container
    if (query.containerName) {
      const containerUris =
        this.containerIndex.get(query.containerName) || new Set();
      if (fileUris.size === 0) {
        fileUris = containerUris;
      } else {
        fileUris = new Set(
          [...fileUris].filter((uri) => containerUris.has(uri)),
        );
      }
    }

    // Filter by file
    if (query.file) {
      const targetUri = pathToFileURL(
        resolve(this.rootPath, query.file),
      ).toString();
      if (fileUris.has(targetUri)) {
        fileUris = new Set([targetUri]);
      } else {
        fileUris = new Set();
      }
    }

    // Collect matching symbols
    const results: IndexedSymbol[] = [];

    for (const uri of fileUris) {
      const fileSymbols = this.fileIndex.get(uri);
      if (!fileSymbols) continue;

      const matchingSymbols = this.filterSymbols(fileSymbols.symbols, query);

      results.push(...matchingSymbols);
    }

    return results;
  }

  /**
   * Get index statistics
   */
  getStats(): IndexStats {
    return { ...this.stats };
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.fileIndex.clear();
    this.symbolIndex.clear();
    this.kindIndex.clear();
    this.containerIndex.clear();
    this.stats = {
      totalFiles: 0,
      totalSymbols: 0,
      indexingTime: 0,
      lastUpdated: new Date(),
    };
  }

  // Private methods

  private storeSymbols(uri: string, symbols: IndexedSymbol[]): void {
    // Store in file index
    this.fileIndex.set(uri, {
      uri,
      lastModified: Date.now(),
      symbols,
    });

    // Update indices
    this.updateIndices(symbols, uri);
  }

  private updateIndices(symbols: IndexedSymbol[], uri: string): void {
    const processSymbol = (symbol: IndexedSymbol, containerName?: string) => {
      // Update name index
      if (!this.symbolIndex.has(symbol.name)) {
        this.symbolIndex.set(symbol.name, new Set());
      }
      this.symbolIndex.get(symbol.name)!.add(uri);

      // Update kind index
      if (!this.kindIndex.has(symbol.kind)) {
        this.kindIndex.set(symbol.kind, new Set());
      }
      this.kindIndex.get(symbol.kind)!.add(uri);

      // Update container index
      if (containerName) {
        if (!this.containerIndex.has(containerName)) {
          this.containerIndex.set(containerName, new Set());
        }
        this.containerIndex.get(containerName)!.add(uri);
      }

      // Process children
      if (symbol.children) {
        for (const child of symbol.children) {
          processSymbol(child, symbol.name);
        }
      }
    };

    for (const symbol of symbols) {
      processSymbol(symbol);
    }
  }

  private removeFromIndices(symbols: IndexedSymbol[], uri: string): void {
    const processSymbol = (symbol: IndexedSymbol) => {
      // Remove from name index
      const nameUris = this.symbolIndex.get(symbol.name);
      if (nameUris) {
        nameUris.delete(uri);
        if (nameUris.size === 0) {
          this.symbolIndex.delete(symbol.name);
        }
      }

      // Remove from kind index
      const kindUris = this.kindIndex.get(symbol.kind);
      if (kindUris) {
        kindUris.delete(uri);
        if (kindUris.size === 0) {
          this.kindIndex.delete(symbol.kind);
        }
      }

      // Process children
      if (symbol.children) {
        for (const child of symbol.children) {
          processSymbol(child);
        }
      }
    };

    for (const symbol of symbols) {
      processSymbol(symbol);
    }
  }

  private filterSymbols(
    symbols: IndexedSymbol[],
    query: SymbolQuery,
  ): IndexedSymbol[] {
    const results: IndexedSymbol[] = [];

    const processSymbol = (symbol: IndexedSymbol, containerName?: string) => {
      let matches = true;

      // Check name
      if (query.name && !symbol.name.includes(query.name)) {
        matches = false;
      }

      // Check kind
      if (query.kind) {
        const kinds = Array.isArray(query.kind) ? query.kind : [query.kind];
        if (!kinds.includes(symbol.kind)) {
          matches = false;
        }
      }

      // Check container
      if (query.containerName && containerName !== query.containerName) {
        matches = false;
      }

      if (matches) {
        results.push(symbol);
      }

      // Process children if needed
      if (query.includeChildren !== false && symbol.children) {
        for (const child of symbol.children) {
          processSymbol(child, symbol.name);
        }
      }
    };

    for (const symbol of symbols) {
      processSymbol(symbol);
    }

    return results;
  }

  private convertSymbols(rawSymbols: any[], uri: string): IndexedSymbol[] {
    return rawSymbols.map((symbol) => this.convertSymbol(symbol, uri));
  }

  private convertSymbol(symbol: any, uri: string): IndexedSymbol {
    // Handle DocumentSymbol format
    if ("selectionRange" in symbol) {
      return {
        name: symbol.name,
        kind: symbol.kind,
        location: {
          uri,
          range: symbol.range,
        },
        deprecated: symbol.deprecated,
        detail: symbol.detail,
        children: symbol.children?.map((child: any) =>
          this.convertSymbol(child, uri),
        ),
      };
    }

    // Handle SymbolInformation format
    return {
      name: symbol.name,
      kind: symbol.kind,
      location: symbol.location,
      containerName: symbol.containerName,
      deprecated: symbol.deprecated,
    };
  }

  private updateStats(): void {
    let totalSymbols = 0;

    const countSymbols = (symbols: IndexedSymbol[]): number => {
      let count = symbols.length;
      for (const symbol of symbols) {
        if (symbol.children) {
          count += countSymbols(symbol.children);
        }
      }
      return count;
    };

    for (const fileSymbols of this.fileIndex.values()) {
      totalSymbols += countSymbols(fileSymbols.symbols);
    }

    this.stats.totalFiles = this.fileIndex.size;
    this.stats.totalSymbols = totalSymbols;
  }
}
