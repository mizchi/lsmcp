/**
 * In-memory cache implementation
 */

import type { SymbolCache, IndexedSymbol } from "../engine/types.ts";

export class MemoryCache implements SymbolCache {
  private cache: Map<string, IndexedSymbol[]> = new Map();

  async get(filePath: string): Promise<IndexedSymbol[] | null> {
    return this.cache.get(filePath) || null;
  }

  async set(filePath: string, symbols: IndexedSymbol[]): Promise<void> {
    this.cache.set(filePath, symbols);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}
