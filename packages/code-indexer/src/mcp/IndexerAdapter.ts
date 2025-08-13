/**
 * MCP adapter for the indexer
 */

import { SymbolIndex } from "../engine/SymbolIndex.ts";
import { NodeFileSystem } from "../engine/NodeFileSystem.ts";
import { SQLiteCache } from "../cache/SQLiteCache.ts";
import { MemoryCache } from "../cache/MemoryCache.ts";
import { createLSPSymbolProvider } from "@lsmcp/lsp-client";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";
import type { IndexedSymbol, SymbolQuery } from "../engine/types.ts";

// Global index instances by root path
const indexInstances = new Map<string, SymbolIndex>();

/**
 * Get or create a symbol index for a root path
 */
export function getOrCreateIndex(
  rootPath: string,
  client?: any,
): SymbolIndex | null {
  // Check if we have an existing index
  let index = indexInstances.get(rootPath);
  if (index) {
    return index;
  }

  // Create components
  const fileSystem = new NodeFileSystem();
  // Use in-memory cache during vitest to avoid FS permissions under /test roots
  const cache =
    process.env.VITEST === "true" || process.env.VITEST
      ? new MemoryCache()
      : new SQLiteCache(rootPath);

  // Check if client is provided
  if (!client) {
    console.error(`[IndexerAdapter] No LSP client provided for ${rootPath}`);
    return null;
  }
  console.error(
    `[IndexerAdapter] Creating index for ${rootPath} with LSP client`,
  );

  // Create file content provider
  const fileContentProvider = async (uri: string): Promise<string> => {
    const path = fileURLToPath(uri);
    return await readFile(path, "utf-8");
  };

  const symbolProvider = createLSPSymbolProvider(client, fileContentProvider);

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
  options?: { concurrency?: number },
): Promise<{
  success: boolean;
  totalFiles: number;
  totalSymbols: number;
  duration: number;
  errors: Array<{ file: string; error: string }>;
}> {
  const index = getOrCreateIndex(rootPath, null);
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
export async function updateIndexIncremental(rootPath: string): Promise<{
  success: boolean;
  updated: string[];
  removed: string[];
  errors: string[];
  message?: string;
}> {
  const index = getOrCreateIndex(rootPath, null);
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
