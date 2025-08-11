// Indexer and cache domain types

import type { IndexedSymbol } from "../lsp/symbols.ts";

export interface SymbolIndex {
  addSymbol(symbol: IndexedSymbol): void;
  removeSymbol(symbolId: string): void;
  updateSymbol(symbolId: string, symbol: Partial<IndexedSymbol>): void;
  getSymbol(symbolId: string): IndexedSymbol | undefined;
  searchSymbols(query: SymbolSearchQuery): IndexedSymbol[];
  clear(): void;
  getStats(): IndexStats;
}

export interface SymbolSearchQuery {
  name?: string | RegExp;
  kind?: string | string[];
  file?: string | RegExp;
  containerName?: string;
  limit?: number;
  offset?: number;
}

export interface IndexStats {
  totalSymbols: number;
  totalFiles: number;
  symbolsByKind: Map<string, number>;
  filesByExtension: Map<string, number>;
  indexingTime?: number;
  lastUpdated?: Date;
  memoryUsage?: number;
}

export interface IndexCache {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

export interface IndexingResult {
  filesIndexed: number;
  symbolsFound: number;
  errors: IndexingError[];
  duration: number;
  incremental: boolean;
}

export interface IndexingError {
  file: string;
  error: string;
  stack?: string;
}

export interface IndexConfiguration {
  patterns?: string[];
  exclude?: string[];
  maxFiles?: number;
  maxSymbolsPerFile?: number;
  incremental?: boolean;
  cache?: boolean;
  concurrency?: number;
}

export interface FileIndexResult {
  file: string;
  symbols: IndexedSymbol[];
  parseTime: number;
  error?: string;
}

export interface IncrementalUpdate {
  added: string[];
  modified: string[];
  deleted: string[];
  timestamp: Date;
}
