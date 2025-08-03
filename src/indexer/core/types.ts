/**
 * Core types for symbol indexing
 */

import { SymbolKind, Location } from "vscode-languageserver-types";

/**
 * Indexed symbol information
 */
export interface IndexedSymbol {
  name: string;
  kind: SymbolKind;
  location: Location;
  containerName?: string;
  deprecated?: boolean;
  detail?: string;
  children?: IndexedSymbol[];
}

/**
 * File symbol information
 */
export interface FileSymbols {
  uri: string;
  lastModified: number;
  symbols: IndexedSymbol[];
}

/**
 * Symbol query parameters
 */
export interface SymbolQuery {
  name?: string;
  kind?: SymbolKind | SymbolKind[];
  file?: string;
  containerName?: string;
  includeChildren?: boolean;
}

/**
 * Index statistics
 */
export interface IndexStats {
  totalFiles: number;
  totalSymbols: number;
  indexingTime: number;
  lastUpdated: Date;
}

/**
 * Symbol provider interface
 */
export interface SymbolProvider {
  getDocumentSymbols(uri: string): Promise<any[]>;
}

/**
 * File system interface
 */
export interface FileSystem {
  readFile(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ mtime: Date }>;
}

/**
 * Cache interface
 */
export interface SymbolCache {
  get(filePath: string): Promise<IndexedSymbol[] | null>;
  set(filePath: string, symbols: IndexedSymbol[]): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Index event types
 */
export type IndexEvent =
  | {
      type: "fileIndexed";
      uri: string;
      symbolCount: number;
      fromCache: boolean;
    }
  | { type: "fileRemoved"; uri: string }
  | { type: "indexError"; uri: string; error: Error }
  | { type: "indexingStarted"; fileCount: number }
  | { type: "indexingCompleted"; duration: number };
