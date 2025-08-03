import { SymbolCacheManager } from "./symbolCache.ts";
import type {
  SymbolIndexState,
  SymbolEntry,
} from "../../mcp/analysis/symbolIndex.ts";
import { statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { relative } from "node:path";
import type { CachedSymbol } from "../types/index.ts";
import { SymbolKind } from "vscode-languageserver-types";

// Global cache managers per project root
const cacheManagers = new Map<string, SymbolCacheManager>();

export function getSymbolCacheManager(rootPath: string): SymbolCacheManager {
  let manager = cacheManagers.get(rootPath);
  if (!manager) {
    manager = new SymbolCacheManager(rootPath);
    cacheManagers.set(rootPath, manager);
  }
  return manager;
}

/**
 * Cache symbols from the index to SQLite
 */
export async function cacheSymbolsFromIndex(
  state: SymbolIndexState,
  filePath: string,
): Promise<void> {
  const manager = getSymbolCacheManager(state.rootPath);
  const fileSymbols = state.fileIndex.get(pathToFileURL(filePath).toString());

  if (!fileSymbols) {
    return;
  }

  const relativePath = relative(state.rootPath, filePath);
  const stats = statSync(filePath);
  const lastModified = stats.mtimeMs;

  await manager.cacheSymbols(relativePath, fileSymbols.symbols, lastModified);
}

/**
 * Load cached symbols into the index
 */
export function loadCachedSymbols(
  state: SymbolIndexState,
  filePath: string,
): SymbolEntry[] | null {
  const manager = getSymbolCacheManager(state.rootPath);
  const relativePath = relative(state.rootPath, filePath);

  try {
    const stats = statSync(filePath);
    const cachedSymbols = manager.getSymbolsByFile(relativePath);

    if (cachedSymbols.length === 0) {
      return null;
    }

    // Check if cache is still valid
    const cacheTime = cachedSymbols[0].lastModified;
    if (stats.mtimeMs > cacheTime) {
      // File has been modified, invalidate cache
      manager.invalidateFile(relativePath);
      return null;
    }

    // Convert cached symbols back to SymbolEntry format
    return convertCachedToSymbolEntries(cachedSymbols, filePath);
  } catch {
    return null;
  }
}

/**
 * Search symbols in cache
 */
export function searchSymbolsInCache(
  rootPath: string,
  pattern: string,
): CachedSymbol[] {
  const manager = getSymbolCacheManager(rootPath);
  return manager.searchSymbols(pattern);
}

/**
 * Convert cached symbols to SymbolEntry format
 */
function convertCachedToSymbolEntries(
  cachedSymbols: CachedSymbol[],
  absolutePath: string,
): SymbolEntry[] {
  const uri = pathToFileURL(absolutePath).toString();
  const symbolMap = new Map<string, SymbolEntry>();
  const rootSymbols: SymbolEntry[] = [];

  // First pass: create all symbols
  for (const cached of cachedSymbols) {
    const symbol: SymbolEntry = {
      name: cached.namePath.split("/").pop() || cached.namePath,
      kind: cached.kind as SymbolKind,
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
 * Clear all caches and close connections
 */
export function closeAllCaches(): void {
  for (const [_, manager] of cacheManagers) {
    manager.close();
  }
  cacheManagers.clear();
}
