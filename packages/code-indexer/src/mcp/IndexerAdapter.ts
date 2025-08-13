/**
 * Adapter facade for the indexer
 */

import { SymbolIndex } from "../engine/SymbolIndex.ts";
import { NodeFileSystem } from "../engine/NodeFileSystem.ts";
import { SQLiteCache } from "../cache/SQLiteCache.ts";
import { MemoryCache } from "../cache/MemoryCache.ts";
import { createLSPSymbolProvider } from "@lsmcp/lsp-client";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";
import type { IndexedSymbol, SymbolQuery } from "../engine/types.ts";

/**
 * Dependencies for indexer facade.
 * Callers pass plain deps; required fields will be picked if present.
 */
export type IndexerDeps = {
  lspClient?: any;
  fileSystem?: any;
  fs?: any; // alias for compatibility
  symbolProvider?: any;
};

// Global index instances by root path
const indexInstances = new Map<string, SymbolIndex>();

/**
 * Get or create a symbol index for a root path
 */
export function getOrCreateIndex(
  rootPath: string,
  context?: IndexerDeps | any,
): SymbolIndex | null {
  // Check if we have an existing index
  let index = indexInstances.get(rootPath);
  if (index) {
    return index;
  }

  // Resolve file system from context or fallback to NodeFileSystem
  // Support both "fileSystem" and "fs" to align with common context shapes
  let fileSystem: any;
  if (context && typeof context === "object") {
    if ("fs" in context && context.fs) {
      fileSystem = context.fs;
    } else if ("fileSystem" in context && context.fileSystem) {
      fileSystem = context.fileSystem;
    } else {
      fileSystem = new NodeFileSystem();
    }
  } else {
    fileSystem = new NodeFileSystem();
  }
  
  // Debug: Check if fileSystem has the required methods
  if (typeof fileSystem.readFile !== "function") {
    console.error("[IndexerAdapter] Warning: fileSystem.readFile is not a function. Using NodeFileSystem.");
    fileSystem = new NodeFileSystem();
  }

  // Use in-memory cache during vitest to avoid FS permissions under /test roots
  const cache =
    process.env.VITEST === "true" || process.env.VITEST
      ? new MemoryCache()
      : new SQLiteCache(rootPath);

  // Prefer explicitly injected symbol provider
  const hasSymbolProvider = !!(
    context &&
    typeof context === "object" &&
    "symbolProvider" in context &&
    context.symbolProvider
  );

  let symbolProvider: any;

  if (hasSymbolProvider) {
    symbolProvider = context.symbolProvider;
  } else {
    // Extract LSP client ONLY from explicit context (global fallback is deprecated)
    let lspClient: any = undefined;
    if (context && typeof context === "object" && "lspClient" in context) {
      lspClient = context.lspClient;
    } else if (context) {
      // Legacy: direct client passed
      lspClient = context;
    }

    if (!lspClient) {
      console.error(
        `[IndexerAdapter] No LSP client or symbolProvider available for ${rootPath}. Provide via { lspClient } or { symbolProvider }.`,
      );
      return null;
    }

    // Create LSPSymbolProvider from explicit LSP client
    const fileContentProvider = async (uri: string): Promise<string> => {
      const path = fileURLToPath(uri);
      return await readFile(path, "utf-8");
    };
    symbolProvider = createLSPSymbolProvider(lspClient, fileContentProvider);
  }

  // Create index
  index = new SymbolIndex(rootPath, symbolProvider, fileSystem, cache);

  // Store instance
  indexInstances.set(rootPath, index);

  return index;
}

/**
 * Clear index for a root path
 */
export function clearIndex(rootPath: string): void {
  const index = indexInstances.get(rootPath);
  if (index) {
    index.clear();
    index.removeAllListeners();
    indexInstances.delete(rootPath);
  }
}

/**
 * Force clear index including cache
 */
export async function forceClearIndex(rootPath: string): Promise<void> {
  const index = indexInstances.get(rootPath);
  if (index) {
    await index.forceClear();
    index.removeAllListeners();
    indexInstances.delete(rootPath);
  }
}

/**
 * Index files using the new implementation
 */
export async function indexFiles(
  rootPath: string,
  filePaths: string[],
  options?: { concurrency?: number; context?: IndexerDeps },
): Promise<{
  success: boolean;
  totalFiles: number;
  totalSymbols: number;
  duration: number;
  errors: Array<{ file: string; error: string }>;
}> {
  const index = getOrCreateIndex(rootPath, options?.context);
  if (!index) {
    return {
      success: false,
      totalFiles: 0,
      totalSymbols: 0,
      duration: 0,
      errors: [{ file: "", error: "LSP client not initialized" }],
    };
  }

  const startTime = Date.now();
  const errors: Array<{ file: string; error: string }> = [];

  // Listen for errors
  const errorHandler = (event: any) => {
    if (event.type === "indexError") {
      const path = fileURLToPath(event.uri);
      errors.push({
        file: path,
        error: event.error.message,
      });
    }
  };

  index.on("indexError", errorHandler);

  try {
    // Index files
    await index.indexFiles(filePaths, options?.concurrency);

    // Get stats
    const stats = index.getStats();

    return {
      success: true,
      totalFiles: stats.totalFiles,
      totalSymbols: stats.totalSymbols,
      duration: Date.now() - startTime,
      errors,
    };
  } finally {
    index.off("indexError", errorHandler);
  }
}

/**
 * Query symbols using the new implementation
 */
export function querySymbols(
  rootPath: string,
  query: SymbolQuery,
): IndexedSymbol[] {
  const index = indexInstances.get(rootPath);
  if (!index) {
    return [];
  }

  return index.querySymbols(query);
}

/**
 * Get index statistics
 */
export function getIndexStats(rootPath: string) {
  const index = indexInstances.get(rootPath);
  if (!index) {
    return {
      totalFiles: 0,
      totalSymbols: 0,
      indexingTime: 0,
      lastUpdated: new Date(),
    };
  }

  return index.getStats();
}

/**
 * Update index incrementally
 */
export async function updateIndexIncremental(
  rootPath: string,
  context?: IndexerDeps,
): Promise<{
  success: boolean;
  updated: string[];
  removed: string[];
  errors: string[];
  message?: string;
}> {
  const index = getOrCreateIndex(rootPath, context);
  if (!index) {
    return {
      success: false,
      updated: [],
      removed: [],
      errors: [],
      message: "Failed to create index",
    };
  }

  try {
    const result = await index.updateIncremental();
    return {
      success: true,
      ...result,
    };
  } catch (error) {
    return {
      success: false,
      updated: [],
      removed: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
