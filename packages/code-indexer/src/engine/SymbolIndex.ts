/**
 * Core symbol index implementation
 * With incremental update support
 */

import { EventEmitter } from "events";
import { pathToFileURL } from "url";
import { resolve } from "path";
import { getContentHash } from "./contentHash.ts";
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
import {
  getGitHashAsync,
  getModifiedFilesAsync,
  getFileGitHash,
  getUntrackedFilesAsync,
} from "../utils/gitUtils.ts";
import { shouldExcludeSymbol, type IndexConfig } from "../config/config.ts";
import { debugLogWithPrefix } from "../../../../src/utils/debugLog.ts";

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
  private config?: IndexConfig;

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
      // Read file content first (we need it for content hash)
      const content = await this.fileSystem.readFile(absolutePath);
      const contentHash = getContentHash(content);

      // Check if we have this exact content already indexed
      const existingFile = this.fileIndex.get(uri);
      if (existingFile && existingFile.contentHash === contentHash) {
        // Content hasn't changed, skip reindexing
        this.emit("fileIndexed", {
          type: "fileIndexed",
          uri,
          symbolCount: existingFile.symbols.length,
          fromCache: true,
        } as IndexEvent);
        return;
      }

      // Try cache
      if (this.cache) {
        const cachedSymbols = await this.cache.get(absolutePath);
        if (cachedSymbols) {
          this.storeSymbols(uri, cachedSymbols, undefined, contentHash);
          this.emit("fileIndexed", {
            type: "fileIndexed",
            uri,
            symbolCount: cachedSymbols.length,
            fromCache: true,
          } as IndexEvent);
          return;
        }
      }

      // Get symbols from provider
      const rawSymbols = await this.symbolProvider.getDocumentSymbols(uri);

      if (!rawSymbols || rawSymbols.length === 0) {
        return;
      }

      // Convert symbols
      const symbols = this.convertSymbols(rawSymbols, uri);

      // Get git hash for the file
      const gitHashResult = await getFileGitHash(this.rootPath, absolutePath);
      const gitHash = gitHashResult.isOk()
        ? (gitHashResult.value ?? undefined)
        : undefined;

      // Store in index with content hash (already calculated above)
      this.storeSymbols(uri, symbols, gitHash, contentHash);

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
   * Initialize index with configuration
   */
  async initialize(): Promise<void> {
    // Use synchronous config loader
    const { loadIndexConfig: loadConfig } = await import(
      "../config/configLoader.ts"
    );
    this.config = loadConfig(this.rootPath);
    debugLogWithPrefix("SymbolIndex", "Loaded config:", this.config?.symbolFilter);
  }

  /**
   * Index multiple files
   */
  async indexFiles(
    filePaths: string[],
    concurrency = 5,
    options?: {
      onProgress?: (progress: { current: number; total: number }) => void;
      skipFailures?: boolean;
    },
  ): Promise<void> {
    // Load configuration if not already loaded
    if (!this.config) {
      await this.initialize();
    }

    this.emit("indexingStarted", {
      type: "indexingStarted",
      fileCount: filePaths.length,
    } as IndexEvent);

    const startTime = Date.now();
    const totalFiles = filePaths.length;
    let processedFiles = 0;
    let failedFiles = 0;

    // Process in chunks
    for (let i = 0; i < filePaths.length; i += concurrency) {
      const chunk = filePaths.slice(i, i + concurrency);

      const promises = chunk.map(async (file) => {
        try {
          await this.indexFile(file);
          processedFiles++;
        } catch (error) {
          failedFiles++;
          debugLogWithPrefix(
            "SymbolIndex",
            `Failed to index ${file}: ${error instanceof Error ? error.message : String(error)}`,
          );
          if (!options?.skipFailures) {
            throw error;
          }
        }
      });

      await Promise.all(promises);

      // Report progress
      if (options?.onProgress) {
        options.onProgress({ current: processedFiles, total: totalFiles });
      }

      // Add a small delay between batches to prevent overwhelming the system
      if (i + concurrency < filePaths.length) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }

    const duration = Date.now() - startTime;

    // Save current git hash
    const gitHashResult = await getGitHashAsync(this.rootPath);
    if (gitHashResult.isOk()) {
      this.stats.lastGitHash = gitHashResult.value;
    }

    debugLogWithPrefix(
      "SymbolIndex",
      `Indexed ${processedFiles}/${totalFiles} files in ${duration}ms (${failedFiles} failures)`,
    );

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
    if (!query.name && !query.kind && !query.file) {
      fileUris = new Set(this.fileIndex.keys());
    }

    // Filter by name (partial match)
    if (query.name) {
      const nameUris = new Set<string>();
      // Check all symbol names for partial match
      for (const [symbolName, uris] of this.symbolIndex) {
        if (symbolName.includes(query.name)) {
          uris.forEach((uri) => nameUris.add(uri));
        }
      }
      if (fileUris.size === 0) {
        fileUris = nameUris;
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
      // Check if the file exists in the index
      if (this.fileIndex.has(targetUri)) {
        // If no other filters were applied, start with this file
        if (
          fileUris.size === 0 &&
          !query.name &&
          !query.kind &&
          !query.containerName
        ) {
          fileUris = new Set([targetUri]);
        } else if (fileUris.has(targetUri)) {
          fileUris = new Set([targetUri]);
        } else {
          fileUris = new Set();
        }
      } else {
        // Try to find a matching file by relative path
        for (const [uri] of this.fileIndex) {
          if (uri.endsWith(query.file) || uri.includes(query.file)) {
            fileUris = new Set([uri]);
            break;
          }
        }
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
    this.emit("cleared");
  }

  /**
   * Force clear all data including cache
   */
  async forceClear(): Promise<void> {
    // Clear memory indices
    this.clear();

    // Clear cache if available
    if (this.cache) {
      await this.cache.clear();
    }

    // Reset all stats
    this.stats = {
      totalFiles: 0,
      totalSymbols: 0,
      indexingTime: 0,
      lastUpdated: new Date(),
      lastGitHash: undefined,
    };
  }

  /**
   * Update index incrementally based on git changes
   */
  async updateIncremental(options?: {
    batchSize?: number;
    onProgress?: (progress: { current: number; total: number }) => void;
  }): Promise<{
    updated: string[];
    removed: string[];
    errors: string[];
  }> {
    const batchSize = options?.batchSize || 5; // Reduced from 10 to 5 for better stability
    debugLogWithPrefix(
      "SymbolIndex",
      `updateIncremental started for ${this.rootPath}`,
    );

    const currentHashResult = await getGitHashAsync(this.rootPath);

    if (currentHashResult.isErr()) {
      debugLogWithPrefix(
        "SymbolIndex",
        `Git hash error: ${currentHashResult.error.message}`,
      );
      // Not a git repository or error, fall back to full index
      return {
        updated: [],
        removed: [],
        errors: [currentHashResult.error.message],
      };
    }

    const currentHash = currentHashResult.value;
    debugLogWithPrefix("SymbolIndex", `Current git hash: ${currentHash}`);

    // Check if not a git repository
    if (!currentHash) {
      return {
        updated: [],
        removed: [],
        errors: ["Not a git repository"],
      };
    }

    const lastHash = this.stats.lastGitHash;
    debugLogWithPrefix("SymbolIndex", `Last git hash: ${lastHash}`);

    if (!lastHash) {
      // First time, do full index
      return {
        updated: [],
        removed: [],
        errors: ["No previous git hash found"],
      };
    }

    debugLogWithPrefix("SymbolIndex", `Getting modified files since ${lastHash}`);
    const modifiedFilesResult = await getModifiedFilesAsync(
      this.rootPath,
      lastHash,
    );

    if (modifiedFilesResult.isErr()) {
      debugLogWithPrefix(
        "SymbolIndex",
        `Error getting modified files: ${modifiedFilesResult.error.message}`,
      );
      // If we can't get diff, fall back to full reindex
      return {
        updated: [],
        removed: [],
        errors: [modifiedFilesResult.error.message],
      };
    }

    const modifiedFiles = modifiedFilesResult.value;
    debugLogWithPrefix("SymbolIndex", `Found ${modifiedFiles.length} modified files`);

    debugLogWithPrefix("SymbolIndex", "Getting untracked files");
    const untrackedFilesResult = await getUntrackedFilesAsync(this.rootPath);

    if (untrackedFilesResult.isErr()) {
      debugLogWithPrefix(
        "SymbolIndex",
        `Error getting untracked files: ${untrackedFilesResult.error.message}`,
      );
      // Continue with just modified files if untracked fails
    }

    const untrackedFiles = untrackedFilesResult.isOk()
      ? untrackedFilesResult.value
      : [];
    debugLogWithPrefix(
      "SymbolIndex",
      `Found ${untrackedFiles.length} untracked files`,
    );

    // Filter both modified and untracked files to only include TypeScript/JavaScript files
    const supportedExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts"];

    const isSupported = (file: string): boolean => {
      return supportedExtensions.some((ext) => file.endsWith(ext));
    };

    const tsModifiedFiles = modifiedFiles.filter(isSupported);
    const tsUntrackedFiles = untrackedFiles.filter(isSupported);

    debugLogWithPrefix(
      "SymbolIndex",
      `Filtered to ${tsModifiedFiles.length} modified TS/JS files`,
    );
    debugLogWithPrefix(
      "SymbolIndex",
      `Filtered to ${tsUntrackedFiles.length} untracked TS/JS files`,
    );

    // Combine modified and untracked files
    const allFiles = [...new Set([...tsModifiedFiles, ...tsUntrackedFiles])];
    const totalFiles = allFiles.length;

    const updated: string[] = [];
    const removed: string[] = [];
    const errors: string[] = [];

    // Process files in batches to avoid memory issues
    // Use more efficient batch processing with memory management
    let processedCount = 0;

    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batch = allFiles.slice(i, Math.min(i + batchSize, allFiles.length));

      // Report progress before processing batch
      if (options?.onProgress) {
        options.onProgress({ current: processedCount, total: totalFiles });
      }

      // Process batch concurrently with controlled memory usage
      const batchPromises = batch.map(async (file) => {
        const absolutePath = resolve(this.rootPath, file);

        try {
          // Check if file still exists
          if (await this.fileSystem.exists(absolutePath)) {
            // Re-index the file
            await this.indexFile(file);
            return { type: "updated" as const, file };
          } else {
            // File was deleted
            this.removeFile(file);
            return { type: "removed" as const, file };
          }
        } catch (error) {
          return {
            type: "error" as const,
            file,
            error: `${file}: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Collect results immediately to free memory
      for (const result of batchResults) {
        switch (result.type) {
          case "updated":
            updated.push(result.file);
            break;
          case "removed":
            removed.push(result.file);
            break;
          case "error":
            errors.push(result.error);
            break;
        }
      }

      processedCount += batch.length;

      // For very large batches, add a small yield to prevent blocking
      // Only add delay for very large sets of files
      if (allFiles.length > 1000 && i + batchSize < allFiles.length) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Clear references to help garbage collection for large batches
      if (processedCount % 500 === 0 && global.gc) {
        global.gc();
      }
    }

    // Final progress report
    if (options?.onProgress) {
      options.onProgress({ current: totalFiles, total: totalFiles });
    }

    // Update git hash
    this.stats.lastGitHash = currentHash;
    this.stats.lastUpdated = new Date();

    debugLogWithPrefix(
      "SymbolIndex",
      `Incremental update completed: ${updated.length} updated, ${removed.length} removed, ${errors.length} errors`,
    );

    return { updated, removed, errors };
  }

  /**
   * Check if a file needs re-indexing
   */
  async needsReindex(filePath: string): Promise<boolean> {
    const absolutePath = resolve(this.rootPath, filePath);
    const uri = pathToFileURL(absolutePath).toString();

    const fileSymbols = this.fileIndex.get(uri);
    if (!fileSymbols) {
      return true; // Not indexed yet
    }

    // Check git hash first if available (more reliable than mtime)
    const hashResult = await getFileGitHash(this.rootPath, absolutePath);
    if (hashResult.isOk() && fileSymbols.gitHash) {
      // Both have git hashes, compare them
      return hashResult.value !== fileSymbols.gitHash;
    }

    // Fall back to file modification time if git hash not available
    try {
      const stats = await this.fileSystem.stat(absolutePath);
      const mtime = stats.mtime.getTime();

      if (mtime > fileSymbols.lastIndexed) {
        return true; // File modified since last index
      }
    } catch {
      return true; // Can't stat file, assume needs reindex
    }

    return false;
  }

  // Private methods

  private storeSymbols(
    uri: string,
    symbols: IndexedSymbol[],
    gitHash?: string,
    contentHash?: string,
  ): void {
    // Store in file index
    this.fileIndex.set(uri, {
      uri,
      lastModified: Date.now(),
      lastIndexed: Date.now(),
      gitHash,
      contentHash,
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

      // Check name (case-insensitive)
      if (
        query.name &&
        !symbol.name.toLowerCase().includes(query.name.toLowerCase())
      ) {
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
    const symbols = rawSymbols.map((symbol) => this.convertSymbol(symbol, uri));

    // Apply symbol filtering if configured
    if (this.config?.symbolFilter) {
      return this.filterSymbolsByConfig(symbols);
    }

    return symbols;
  }

  private filterSymbolsByConfig(symbols: IndexedSymbol[]): IndexedSymbol[] {
    const filter = this.config?.symbolFilter;
    if (!filter) return symbols;

    const filtered: IndexedSymbol[] = [];

    for (const symbol of symbols) {
      // Check if symbol should be excluded
      if (shouldExcludeSymbol(symbol, filter)) {
        continue;
      }

      // If symbol has children, filter them recursively
      let filteredSymbol = symbol;
      if (symbol.children) {
        const filteredChildren = this.filterSymbolsByConfig(symbol.children);
        if (filteredChildren.length > 0 || !filter.includeOnlyTopLevel) {
          filteredSymbol = {
            ...symbol,
            children: filteredChildren,
          };
        } else {
          // Skip parent if all children were filtered out
          continue;
        }
      }

      filtered.push(filteredSymbol);
    }

    return filtered;
  }

  private convertSymbol(
    symbol: any,
    uri: string,
    containerName?: string,
  ): IndexedSymbol {
    // Handle DocumentSymbol format
    if ("selectionRange" in symbol) {
      const converted: IndexedSymbol = {
        name: symbol.name,
        kind: symbol.kind,
        location: {
          uri,
          range: symbol.range,
        },
        containerName,
        deprecated: symbol.deprecated,
        detail: symbol.detail,
        children: symbol.children?.map((child: any) =>
          this.convertSymbol(child, uri, symbol.name),
        ),
      };
      return converted;
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
