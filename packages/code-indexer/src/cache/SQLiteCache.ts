/**
 * SQLite cache implementation using SymbolCacheManager
 */

import type { SymbolCache, IndexedSymbol } from "../engine/types.ts";
import { SymbolCacheManager } from "./SymbolCacheManager.ts";
import type { SymbolEntry } from "../symbolIndex.ts";
import { relative, join } from "path";
import { statSync } from "fs";
import { pathToFileURL } from "url";
import { debugLogWithPrefix } from "../../../../src/utils/debugLog.ts";

export class SQLiteCache implements SymbolCache {
  private manager: SymbolCacheManager;
  private needsReindexing: boolean;

  constructor(private rootPath: string) {
    this.manager = new SymbolCacheManager(rootPath);
    this.needsReindexing = this.manager.wasSchemaUpdated();

    if (this.needsReindexing) {
      debugLogWithPrefix(
        "SQLiteCache",
        `Schema updated to version ${this.manager.getSchemaVersion()}, full reindexing required`,
      );
    }
  }

  async get(filePath: string): Promise<IndexedSymbol[] | null> {
    // If schema was updated, always return null to force re-indexing
    if (this.needsReindexing) {
      return null;
    }

    try {
      const relativePath = relative(this.rootPath, filePath);
      const stats = statSync(filePath);
      const cachedSymbols = this.manager.getSymbolsByFile(relativePath);

      if (cachedSymbols.length === 0) {
        return null;
      }

      // Check if cache is still valid
      const cacheTime = cachedSymbols[0].lastModified;
      if (stats.mtimeMs > cacheTime) {
        // File has been modified, invalidate cache
        this.manager.invalidateFile(relativePath);
        return null;
      }

      // Convert cached symbols to IndexedSymbol format
      return this.convertCachedToIndexedSymbols(cachedSymbols, filePath);
    } catch {
      return null;
    }
  }

  async set(filePath: string, symbols: IndexedSymbol[]): Promise<void> {
    const relativePath = relative(this.rootPath, filePath);
    const stats = statSync(filePath);
    const lastModified = stats.mtimeMs;

    // Convert IndexedSymbol to SymbolEntry format for caching
    const symbolEntries = this.convertIndexedToSymbolEntries(symbols);

    await this.manager.cacheSymbols(relativePath, symbolEntries, lastModified);
  }

  async clear(): Promise<void> {
    this.manager.clearCache();
  }

  private convertIndexedToSymbolEntries(
    symbols: IndexedSymbol[],
  ): SymbolEntry[] {
    return symbols.map((symbol) => ({
      name: symbol.name,
      kind: symbol.kind,
      location: symbol.location,
      containerName: symbol.containerName,
      deprecated: symbol.deprecated,
      detail: symbol.detail,
      children: symbol.children
        ? this.convertIndexedToSymbolEntries(symbol.children)
        : undefined,
    }));
  }

  private convertCachedToIndexedSymbols(
    cachedSymbols: any[],
    absolutePath: string,
  ): IndexedSymbol[] {
    const uri = pathToFileURL(absolutePath).toString();
    const symbolMap = new Map<string, IndexedSymbol>();
    const rootSymbols: IndexedSymbol[] = [];

    // First pass: create all symbols
    for (const cached of cachedSymbols) {
      const symbol: IndexedSymbol = {
        name: cached.namePath.split("/").pop() || cached.namePath,
        kind: cached.kind,
        location: {
          uri,
          range: {
            start: {
              line: cached.startLine,
              character: cached.startCharacter,
            },
            end: {
              line: cached.endLine,
              character: cached.endCharacter,
            },
          },
        },
        containerName: cached.containerName,
      };

      symbolMap.set(cached.namePath, symbol);
    }

    // Second pass: build hierarchy
    for (const cached of cachedSymbols) {
      const symbol = symbolMap.get(cached.namePath)!;

      if (cached.containerName) {
        // Find parent symbol
        const parentPath = cached.namePath.substring(
          0,
          cached.namePath.lastIndexOf("/"),
        );
        const parent = symbolMap.get(parentPath);

        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(symbol);
        } else {
          rootSymbols.push(symbol);
        }
      } else {
        rootSymbols.push(symbol);
      }
    }

    return rootSymbols;
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalSymbols: number; totalFiles: number } {
    return this.manager.getStats();
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.manager.close();
  }

  /**
   * Check if full reindexing is required due to schema update
   */
  requiresReindexing(): boolean {
    return this.needsReindexing;
  }

  /**
   * Mark reindexing as completed
   */
  markReindexingComplete(): void {
    this.needsReindexing = false;
  }
  
  /**
   * Get all cached file paths
   */
  async getAllFiles(): Promise<string[]> {
    try {
      const relativeFiles = this.manager.getAllFiles();
      
      // Convert relative paths to absolute paths
      const absoluteFiles = relativeFiles.map(relativePath => {
        if (relativePath.startsWith("/")) {
          return relativePath;
        }
        return join(this.rootPath, relativePath);
      });
      
      return absoluteFiles;
    } catch (error) {
      debugLogWithPrefix(
        "SQLiteCache",
        `Failed to get all files: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }
  
  /**
   * Get cached file info with last modified time
   */
  async getFileInfo(filePath: string): Promise<{ lastModified: number } | null> {
    try {
      const relativePath = relative(this.rootPath, filePath);
      const cachedSymbols = this.manager.getSymbolsByFile(relativePath);
      
      if (cachedSymbols.length === 0) {
        return null;
      }
      
      return {
        lastModified: cachedSymbols[0].lastModified
      };
    } catch {
      return null;
    }
  }
}
