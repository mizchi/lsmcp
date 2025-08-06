/**
 * Configuration types for symbol indexing
 */

import { SymbolKind } from "vscode-languageserver-types";

export interface SymbolFilterConfig {
  // Exclude specific symbol kinds
  excludeKinds?: string[];
  // Exclude symbols matching these patterns
  excludePatterns?: string[];
  // Only include top-level symbols
  includeOnlyTopLevel?: boolean;
}

export interface IndexConfig {
  version?: string;
  indexFiles?: string[];
  settings?: {
    autoIndex?: boolean;
    indexConcurrency?: number;
    autoIndexDelay?: number;
    enableWatchers?: boolean;
    memoryLimit?: number;
  };
  symbolFilter?: SymbolFilterConfig;
  ignorePatterns?: string[];
}

/**
 * Load index configuration from .lsmcp/config.json
 */
export async function loadIndexConfig(rootPath: string): Promise<IndexConfig> {
  try {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");

    const configPath = join(rootPath, ".lsmcp", "config.json");
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    // Return default config if not found
    return {};
  }
}

/**
 * Convert string symbol kind names to SymbolKind enum values
 */
export function parseSymbolKinds(kinds: string[]): SymbolKind[] {
  const kindMap: Record<string, SymbolKind> = {
    File: SymbolKind.File,
    Module: SymbolKind.Module,
    Namespace: SymbolKind.Namespace,
    Package: SymbolKind.Package,
    Class: SymbolKind.Class,
    Method: SymbolKind.Method,
    Property: SymbolKind.Property,
    Field: SymbolKind.Field,
    Constructor: SymbolKind.Constructor,
    Enum: SymbolKind.Enum,
    Interface: SymbolKind.Interface,
    Function: SymbolKind.Function,
    Variable: SymbolKind.Variable,
    Constant: SymbolKind.Constant,
    String: SymbolKind.String,
    Number: SymbolKind.Number,
    Boolean: SymbolKind.Boolean,
    Array: SymbolKind.Array,
    Object: SymbolKind.Object,
    Key: SymbolKind.Key,
    Null: SymbolKind.Null,
    EnumMember: SymbolKind.EnumMember,
    Struct: SymbolKind.Struct,
    Event: SymbolKind.Event,
    Operator: SymbolKind.Operator,
    TypeParameter: SymbolKind.TypeParameter,
  };

  return kinds
    .map((kind) => kindMap[kind])
    .filter((kind) => kind !== undefined);
}

/**
 * Check if a symbol should be excluded based on configuration
 */
export function shouldExcludeSymbol(
  symbol: { name: string; kind: SymbolKind },
  config: SymbolFilterConfig,
): boolean {
  // Check excluded kinds
  if (config.excludeKinds) {
    const excludedKinds = parseSymbolKinds(config.excludeKinds);
    if (excludedKinds.includes(symbol.kind)) {
      return true;
    }
  }

  // Check excluded patterns
  if (config.excludePatterns) {
    for (const pattern of config.excludePatterns) {
      try {
        const regex = new RegExp(pattern);
        if (regex.test(symbol.name)) {
          return true;
        }
      } catch {
        // Simple string match if regex fails
        if (symbol.name.includes(pattern)) {
          return true;
        }
      }
    }
  }

  return false;
}
