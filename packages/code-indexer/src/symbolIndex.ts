/**
 * High-level symbol index for efficient code analysis
 */

import { EventEmitter } from "events";
import {
  DocumentSymbol,
  Location,
  Position,
  Range,
  SymbolInformation,
  SymbolKind,
} from "vscode-languageserver-types";
import { pathToFileURL } from "url";
import { watch, FSWatcher } from "fs";
import { resolve, relative } from "path";
import { getLSPClient } from "@lsmcp/lsp-client";
import type { LSPClient } from "@lsmcp/lsp-client";
import {
  cacheSymbolsFromIndex,
  loadCachedSymbols,
  getSymbolCacheManager,
} from "./cache/symbolCacheIntegration.ts";
import { withTemporaryDocument } from "@lsmcp/lsp-client";
import { readFile } from "fs/promises";
import {
  indexExternalLibraries,
  getAvailableTypescriptDependencies,
  type ExternalLibraryConfig,
  type ExternalLibraryIndexResult,
} from "./providers/externalLibraryProvider.ts";

export interface SymbolEntry {
  name: string;
  kind: SymbolKind;
  location: Location;
  containerName?: string;
  deprecated?: boolean;
  detail?: string;
  children?: SymbolEntry[];
  isExternal?: boolean; // Flag to mark external library symbols
  sourceLibrary?: string; // Source library name (e.g., "neverthrow")
}

export interface FileSymbols {
  uri: string;
  lastModified: number;
  symbols: SymbolEntry[];
}

export interface SymbolQuery {
  name?: string;
  kind?: SymbolKind | SymbolKind[];
  file?: string;
  containerName?: string;
  includeChildren?: boolean;
  includeExternal?: boolean; // Include external library symbols in results
  onlyExternal?: boolean; // Only return external library symbols
  sourceLibrary?: string; // Filter by specific library
}

export interface SymbolIndexStats {
  totalFiles: number;
  totalSymbols: number;
  indexingTime: number;
  lastUpdated: Date;
}

export interface SymbolIndexState {
  fileIndex: Map<string, FileSymbols>;
  symbolIndex: Map<string, SymbolEntry[]>;
  kindIndex: Map<SymbolKind, SymbolEntry[]>;
  containerIndex: Map<string, SymbolEntry[]>;
  fileWatchers: Map<string, FSWatcher>;
  indexingQueue: Set<string>;
  isIndexing: boolean;
  rootPath: string;
  client: LSPClient | null;
  stats: SymbolIndexStats;
  eventEmitter: EventEmitter;
  externalLibraries?: ExternalLibraryIndexResult;
}

/**
 * Create a new symbol index state
 */
function createSymbolIndexState(rootPath: string): SymbolIndexState {
  return {
    fileIndex: new Map(),
    symbolIndex: new Map(),
    kindIndex: new Map(),
    containerIndex: new Map(),
    fileWatchers: new Map(),
    indexingQueue: new Set(),
    isIndexing: false,
    rootPath: resolve(rootPath),
    client: null,
    stats: {
      totalFiles: 0,
      totalSymbols: 0,
      indexingTime: 0,
      lastUpdated: new Date(),
    },
    eventEmitter: new EventEmitter(),
  };
}

/**
 * Initialize the symbol index with LSP client
 */
export async function initializeSymbolIndex(
  state: SymbolIndexState,
): Promise<void> {
  const client = getLSPClient();
  if (!client) {
    throw new Error("LSP client not initialized");
  }
  state.client = client;
}

/**
 * Convert LSP symbols to our format
 */
function convertSymbols(
  symbols: DocumentSymbol[] | SymbolInformation[],
  uri: string,
  containerName?: string,
): SymbolEntry[] {
  return symbols.map((symbol) => {
    if ("location" in symbol) {
      // SymbolInformation
      const info = symbol as SymbolInformation;
      return {
        name: info.name,
        kind: info.kind,
        location: info.location,
        containerName: info.containerName,
        deprecated: info.tags?.includes(1), // SymbolTag.Deprecated = 1
      };
    } else {
      // DocumentSymbol
      const doc = symbol as DocumentSymbol;
      const location: Location = {
        uri,
        range: doc.range,
      };

      const entry: SymbolEntry = {
        name: doc.name,
        kind: doc.kind,
        location,
        containerName,
        deprecated: doc.tags?.includes(1), // SymbolTag.Deprecated = 1
        detail: doc.detail,
      };

      if (doc.children && doc.children.length > 0) {
        entry.children = convertSymbols(doc.children, uri, doc.name);
      }

      return entry;
    }
  });
}

/**
 * Add a symbol to the indices (exported for testing)
 */
export function addSymbolToIndices(
  state: SymbolIndexState,
  symbol: SymbolEntry,
  fileUri: string,
): void {
  // Name index
  if (!state.symbolIndex.has(symbol.name)) {
    state.symbolIndex.set(symbol.name, []);
  }
  state.symbolIndex.get(symbol.name)!.push(symbol);

  // Kind index
  if (!state.kindIndex.has(symbol.kind)) {
    state.kindIndex.set(symbol.kind, []);
  }
  state.kindIndex.get(symbol.kind)!.push(symbol);

  // Container index
  if (symbol.containerName) {
    if (!state.containerIndex.has(symbol.containerName)) {
      state.containerIndex.set(symbol.containerName, []);
    }
    state.containerIndex.get(symbol.containerName)!.push(symbol);
  }

  // Process children recursively
  if (symbol.children) {
    for (const child of symbol.children) {
      addSymbolToIndices(state, child, fileUri);
    }
  }
}

/**
 * Clear file entries from all indices
 */
function clearFileFromIndices(state: SymbolIndexState, uri: string): void {
  const clearFromMap = (map: Map<any, SymbolEntry[]>) => {
    for (const [key, entries] of map.entries()) {
      const filtered = entries.filter((e) => e.location.uri !== uri);
      if (filtered.length === 0) {
        map.delete(key);
      } else {
        map.set(key, filtered);
      }
    }
  };

  clearFromMap(state.symbolIndex);
  clearFromMap(state.kindIndex);
  clearFromMap(state.containerIndex);
}

/**
 * Update all indices with new symbols
 */
function updateIndices(
  state: SymbolIndexState,
  symbols: SymbolEntry[],
  uri: string,
): void {
  // Clear old entries for this file
  clearFileFromIndices(state, uri);

  // Add to indices
  const addToIndex = (symbol: SymbolEntry) => {
    // Name index
    if (!state.symbolIndex.has(symbol.name)) {
      state.symbolIndex.set(symbol.name, []);
    }
    state.symbolIndex.get(symbol.name)!.push(symbol);

    // Kind index
    if (!state.kindIndex.has(symbol.kind)) {
      state.kindIndex.set(symbol.kind, []);
    }
    state.kindIndex.get(symbol.kind)!.push(symbol);

    // Container index
    if (symbol.containerName) {
      if (!state.containerIndex.has(symbol.containerName)) {
        state.containerIndex.set(symbol.containerName, []);
      }
      state.containerIndex.get(symbol.containerName)!.push(symbol);
    }

    // Process children
    if (symbol.children) {
      symbol.children.forEach(addToIndex);
    }
  };

  symbols.forEach(addToIndex);
}

/**
 * Setup file watching
 */
function watchFile(state: SymbolIndexState, filePath: string): void {
  const absolutePath = resolve(state.rootPath, filePath);

  if (state.fileWatchers.has(absolutePath)) {
    return;
  }

  try {
    const watcher = watch(absolutePath, (eventType) => {
      if (eventType === "change") {
        queueReindex(state, filePath);
      } else if (eventType === "rename") {
        removeFileFromIndex(state, filePath);
      }
    });

    state.fileWatchers.set(absolutePath, watcher);
  } catch (error) {
    // File might not exist anymore
    state.eventEmitter.emit("watchError", { filePath, error });
  }
}

/**
 * Queue file for reindexing
 */
function queueReindex(state: SymbolIndexState, filePath: string): void {
  state.indexingQueue.add(filePath);

  // Invalidate cache for this file
  try {
    const manager = getSymbolCacheManager(state.rootPath);
    const relativePath = relative(
      state.rootPath,
      resolve(state.rootPath, filePath),
    );
    manager.invalidateFile(relativePath);
  } catch (error) {
    // Ignore cache errors
  }

  if (!state.isIndexing) {
    processIndexingQueue(state);
  }
}

/**
 * Process indexing queue
 */
async function processIndexingQueue(state: SymbolIndexState): Promise<void> {
  if (state.indexingQueue.size === 0) {
    state.isIndexing = false;
    return;
  }

  state.isIndexing = true;
  const files = Array.from(state.indexingQueue);
  state.indexingQueue.clear();

  await indexFiles(state, files);

  // Continue processing if new files were added
  await processIndexingQueue(state);
}

/**
 * Update statistics
 */
function updateStats(state: SymbolIndexState): void {
  let totalSymbols = 0;

  for (const fileSymbols of state.fileIndex.values()) {
    const countSymbols = (symbols: SymbolEntry[]): number => {
      let count = symbols.length;
      for (const symbol of symbols) {
        if (symbol.children) {
          count += countSymbols(symbol.children);
        }
      }
      return count;
    };

    totalSymbols += countSymbols(fileSymbols.symbols);
  }

  state.stats.totalFiles = state.fileIndex.size;
  state.stats.totalSymbols = totalSymbols;
}

/**
 * Index a single file
 */
export async function indexFile(
  state: SymbolIndexState,
  filePath: string,
): Promise<void> {
  if (!state.client) {
    throw new Error("Symbol index not initialized - LSP client is null");
  }

  const absolutePath = resolve(state.rootPath, filePath);
  const uri = pathToFileURL(absolutePath).toString();
  const startTime = Date.now();

  try {
    // Try to load from cache first
    const cachedSymbols = loadCachedSymbols(state, absolutePath);

    if (cachedSymbols) {
      // Use cached symbols
      state.fileIndex.set(uri, {
        uri,
        lastModified: Date.now(),
        symbols: cachedSymbols,
      });

      // Update symbol indices
      updateIndices(state, cachedSymbols, uri);

      // Setup file watcher
      watchFile(state, filePath);

      // Update stats
      state.stats.indexingTime += Date.now() - startTime;
      state.stats.lastUpdated = new Date();
      updateStats(state);

      state.eventEmitter.emit("fileIndexed", {
        uri,
        symbolCount: cachedSymbols.length,
        fromCache: true,
      });

      return;
    }

    // Read file content
    const content = await readFile(absolutePath, "utf-8");

    // Get document symbols from LSP with temporary document
    const symbols = (await withTemporaryDocument(
      state.client!,
      uri,
      content,
      async () => {
        return await state.client!.getDocumentSymbols(uri);
      },
    )) as any;

    if (!symbols || symbols.length === 0) {
      state.eventEmitter.emit("indexError", {
        uri,
        error: new Error("No symbols returned from LSP"),
      });
      return;
    }

    // Convert symbols to our format
    const entries = convertSymbols(symbols, uri);

    // Store in file index
    state.fileIndex.set(uri, {
      uri,
      lastModified: Date.now(),
      symbols: entries,
    });

    // Update symbol indices
    updateIndices(state, entries, uri);

    // Cache the symbols
    await cacheSymbolsFromIndex(state, absolutePath);

    // Setup file watcher
    watchFile(state, filePath);

    // Update stats
    state.stats.indexingTime += Date.now() - startTime;
    state.stats.lastUpdated = new Date();
    updateStats(state);

    state.eventEmitter.emit("fileIndexed", {
      uri,
      symbolCount: entries.length,
      fromCache: false,
    });
  } catch (error) {
    state.eventEmitter.emit("indexError", {
      uri,
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

/**
 * Index multiple files in parallel
 */
export async function indexFiles(
  state: SymbolIndexState,
  filePaths: string[],
  options?: { concurrency?: number },
): Promise<void> {
  const concurrency = options?.concurrency || 5;
  const chunks = [];
  for (let i = 0; i < filePaths.length; i += concurrency) {
    chunks.push(filePaths.slice(i, i + concurrency));
  }

  let processedCount = 0;
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (file) => {
        try {
          await indexFile(state, file);
          processedCount++;
        } catch (error) {
          // Error is already emitted in indexFile
          console.error(`Failed to index ${file}:`, error);
        }
      }),
    );
  }
}

/**
 * Remove file from index
 */
export function removeFileFromIndex(
  state: SymbolIndexState,
  filePath: string,
): void {
  const uri = pathToFileURL(resolve(state.rootPath, filePath)).toString();

  // Remove from indices
  clearFileFromIndices(state, uri);
  state.fileIndex.delete(uri);

  // Stop watching
  const absolutePath = resolve(state.rootPath, filePath);
  const watcher = state.fileWatchers.get(absolutePath);
  if (watcher) {
    watcher.close();
    state.fileWatchers.delete(absolutePath);
  }

  updateStats(state);
  state.eventEmitter.emit("fileRemoved", { uri });
}

/**
 * Check if position is within range
 */
function positionInRange(position: Position, range: Range): boolean {
  if (position.line < range.start.line || position.line > range.end.line) {
    return false;
  }

  if (
    position.line === range.start.line &&
    position.character < range.start.character
  ) {
    return false;
  }

  if (
    position.line === range.end.line &&
    position.character > range.end.character
  ) {
    return false;
  }

  return true;
}

/**
 * Query symbols with filters
 */
export function querySymbols(
  state: SymbolIndexState,
  query: SymbolQuery,
): SymbolEntry[] {
  let results: SymbolEntry[] = [];

  // Start with name search if specified
  if (query.name) {
    const nameResults = state.symbolIndex.get(query.name) || [];
    results = [...nameResults];

    // Also search for partial matches
    if (results.length === 0) {
      for (const [name, symbols] of state.symbolIndex.entries()) {
        if (name.toLowerCase().includes(query.name.toLowerCase())) {
          results.push(...symbols);
        }
      }
    }
  } else if (query.kind) {
    // Search by kind
    const kinds = Array.isArray(query.kind) ? query.kind : [query.kind];
    for (const kind of kinds) {
      const kindResults = state.kindIndex.get(kind) || [];
      results.push(...kindResults);
    }
  } else if (query.containerName) {
    // Search by container
    results = state.containerIndex.get(query.containerName) || [];
  } else {
    // Return all symbols
    for (const fileSymbols of state.fileIndex.values()) {
      const addSymbols = (symbols: SymbolEntry[]) => {
        for (const symbol of symbols) {
          results.push(symbol);
          if (symbol.children && query.includeChildren !== false) {
            addSymbols(symbol.children);
          }
        }
      };
      addSymbols(fileSymbols.symbols);
    }
  }

  // Apply additional filters
  if (query.file) {
    const fileUri = pathToFileURL(
      resolve(state.rootPath, query.file),
    ).toString();
    results = results.filter((s) => s.location.uri === fileUri);
  }

  if (query.containerName && query.name) {
    results = results.filter((s) => s.containerName === query.containerName);
  }

  // Apply kind filter if both name and kind are specified
  if (query.name && query.kind) {
    const kinds = Array.isArray(query.kind) ? query.kind : [query.kind];
    results = results.filter((s) => kinds.includes(s.kind));
  }

  // Apply external library filters
  if (query.onlyExternal) {
    // Only return external library symbols
    results = results.filter((s) => s.isExternal === true);
  } else if (query.includeExternal === false) {
    // Exclude external library symbols (default behavior)
    results = results.filter((s) => s.isExternal !== true);
  }
  // If includeExternal is true or undefined, include both internal and external symbols

  // Filter by specific library if provided
  if (query.sourceLibrary) {
    results = results.filter((s) => s.sourceLibrary === query.sourceLibrary);
  }

  // Include children if requested
  if (query.includeChildren) {
    const additionalResults: SymbolEntry[] = [];
    for (const symbol of results) {
      if (symbol.children) {
        const addChildren = (children: SymbolEntry[]) => {
          for (const child of children) {
            additionalResults.push(child);
            if (child.children) {
              addChildren(child.children);
            }
          }
        };
        addChildren(symbol.children);
      }
    }
    results = [...results, ...additionalResults];
  }

  return results;
}

/**
 * Get all symbols in a file
 */
export function getFileSymbols(
  state: SymbolIndexState,
  filePath: string,
): SymbolEntry[] {
  const uri = pathToFileURL(resolve(state.rootPath, filePath)).toString();
  const fileSymbols = state.fileIndex.get(uri);
  return fileSymbols ? fileSymbols.symbols : [];
}

/**
 * Get symbol at position
 */
export function getSymbolAtPosition(
  state: SymbolIndexState,
  filePath: string,
  position: Position,
): SymbolEntry | null {
  const symbols = getFileSymbols(state, filePath);

  const findSymbol = (symbols: SymbolEntry[]): SymbolEntry | null => {
    for (const symbol of symbols) {
      const range = symbol.location.range;
      if (positionInRange(position, range)) {
        // Check children first for more specific match
        if (symbol.children) {
          const child = findSymbol(symbol.children);
          if (child) return child;
        }
        return symbol;
      }
    }
    return null;
  };

  return findSymbol(symbols);
}

/**
 * Get index statistics
 */
export function getIndexStats(state: SymbolIndexState): SymbolIndexStats {
  return { ...state.stats };
}

/**
 * Clear the entire index
 */
export function clearIndex(state: SymbolIndexState): void {
  // Close all watchers
  for (const watcher of state.fileWatchers.values()) {
    watcher.close();
  }

  // Clear all indices
  state.fileIndex.clear();
  state.symbolIndex.clear();
  state.kindIndex.clear();
  state.containerIndex.clear();
  state.fileWatchers.clear();
  state.indexingQueue.clear();

  // Reset stats
  state.stats = {
    totalFiles: 0,
    totalSymbols: 0,
    indexingTime: 0,
    lastUpdated: new Date(),
  };

  state.eventEmitter.emit("cleared");
}

/**
 * Add event listener
 */
export function onIndexEvent(
  state: SymbolIndexState,
  event: string,
  listener: (...args: any[]) => void,
): void {
  state.eventEmitter.on(event, listener);
}

/**
 * Remove event listener
 */
export function offIndexEvent(
  state: SymbolIndexState,
  event: string,
  listener: (...args: any[]) => void,
): void {
  state.eventEmitter.off(event, listener);
}

/**
 * Global symbol index instance
 */
let globalIndexState: SymbolIndexState | null = null;

/**
 * Get or create the global symbol index
 */
export function getSymbolIndex(rootPath?: string): SymbolIndexState {
  if (!globalIndexState && rootPath) {
    globalIndexState = createSymbolIndexState(rootPath);
  }

  if (!globalIndexState) {
    throw new Error(
      "Symbol index not initialized. Please provide a root path.",
    );
  }

  return globalIndexState;
}

/**
 * Clear the global symbol index
 */
export function clearSymbolIndex(): void {
  if (globalIndexState) {
    clearIndex(globalIndexState);
    globalIndexState.eventEmitter.removeAllListeners();
    globalIndexState = null;
  }
}

/**
 * Index external libraries (node_modules)
 */
export async function indexExternalLibrariesForState(
  state: SymbolIndexState,
  config?: Partial<ExternalLibraryConfig>,
): Promise<ExternalLibraryIndexResult> {
  if (!state.client) {
    throw new Error("LSP client not initialized");
  }

  console.log("Starting external library indexing...");
  const result = await indexExternalLibraries(
    state.rootPath,
    state.client,
    config,
  );

  // Store the result in state
  state.externalLibraries = result;

  // Add external library symbols to the index with external flags
  for (const fileSymbols of result.files) {
    // Determine library name from file path
    const libraryName = extractLibraryName(fileSymbols.uri);

    // Mark all symbols as external and add library info
    const externalSymbols = markSymbolsAsExternal(
      fileSymbols.symbols,
      libraryName,
    );

    // Create modified file symbols
    const modifiedFileSymbols = {
      ...fileSymbols,
      symbols: externalSymbols,
    };

    // Add to file index
    state.fileIndex.set(fileSymbols.uri, modifiedFileSymbols);

    // Update other indices
    for (const symbol of externalSymbols) {
      addSymbolToIndices(state, symbol, fileSymbols.uri);
    }
  }

  // Update stats
  updateStats(state);
  state.eventEmitter.emit("externalLibrariesIndexed", result);

  return result;
}

/**
 * Extract library name from file URI
 */
function extractLibraryName(uri: string): string {
  const match = uri.match(
    /node_modules[\/\\](@[^\/\\]+[\/\\][^\/\\]+|[^\/\\]+)/,
  );
  if (match) {
    return match[1];
  }
  return "unknown";
}

/**
 * Mark symbols as external recursively
 */
function markSymbolsAsExternal(
  symbols: SymbolEntry[],
  libraryName: string,
): SymbolEntry[] {
  return symbols.map((symbol) => ({
    ...symbol,
    isExternal: true,
    sourceLibrary: libraryName,
    children: symbol.children
      ? markSymbolsAsExternal(symbol.children, libraryName)
      : undefined,
  }));
}

/**
 * Get available TypeScript dependencies
 */
export async function getTypescriptDependencies(
  state: SymbolIndexState,
): Promise<string[]> {
  return await getAvailableTypescriptDependencies(state.rootPath);
}

/**
 * Query external library symbols
 */
export function queryExternalLibrarySymbols(
  state: SymbolIndexState,
  libraryName?: string,
): SymbolEntry[] {
  if (!state.externalLibraries) {
    return [];
  }

  const results: SymbolEntry[] = [];

  for (const fileSymbols of state.externalLibraries.files) {
    // If library name is specified, filter by it
    if (libraryName) {
      const isTargetLibrary =
        fileSymbols.uri.includes(`node_modules/${libraryName}/`) ||
        fileSymbols.uri.includes(`node_modules/@types/${libraryName}/`);
      if (!isTargetLibrary) {
        continue;
      }
    }

    results.push(...fileSymbols.symbols);
  }

  return results;
}
