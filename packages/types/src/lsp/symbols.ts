import { SymbolKind } from "vscode-languageserver-types";

// Symbol-related types for the indexer and symbol operations

export interface BaseSymbol {
  name: string;
  kind: SymbolKind;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface IndexedSymbol extends BaseSymbol {
  id: string;
  file: string;
  detail?: string;
  documentation?: string;
  containerName?: string;
  children?: IndexedSymbol[];
  selectionRange?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface SymbolSearchOptions {
  name?: string;
  kind?: SymbolKind | SymbolKind[];
  file?: string;
  containerName?: string;
  includeChildren?: boolean;
  includeExternal?: boolean;
  onlyExternal?: boolean;
  sourceLibrary?: string;
}

export interface SymbolIndexStats {
  totalFiles: number;
  totalSymbols: number;
  indexingTime: number;
  lastUpdated: Date;
  filesByLanguage: Record<string, number>;
  symbolsByKind: Record<string, number>;
}

export interface ExternalLibrarySymbol extends IndexedSymbol {
  library: string;
  version?: string;
  isExternal: true;
}

// Symbol kind helpers
export const SymbolKindNames: Record<SymbolKind, string> = {
  [SymbolKind.File]: "File",
  [SymbolKind.Module]: "Module",
  [SymbolKind.Namespace]: "Namespace",
  [SymbolKind.Package]: "Package",
  [SymbolKind.Class]: "Class",
  [SymbolKind.Method]: "Method",
  [SymbolKind.Property]: "Property",
  [SymbolKind.Field]: "Field",
  [SymbolKind.Constructor]: "Constructor",
  [SymbolKind.Enum]: "Enum",
  [SymbolKind.Interface]: "Interface",
  [SymbolKind.Function]: "Function",
  [SymbolKind.Variable]: "Variable",
  [SymbolKind.Constant]: "Constant",
  [SymbolKind.String]: "String",
  [SymbolKind.Number]: "Number",
  [SymbolKind.Boolean]: "Boolean",
  [SymbolKind.Array]: "Array",
  [SymbolKind.Object]: "Object",
  [SymbolKind.Key]: "Key",
  [SymbolKind.Null]: "Null",
  [SymbolKind.EnumMember]: "EnumMember",
  [SymbolKind.Struct]: "Struct",
  [SymbolKind.Event]: "Event",
  [SymbolKind.Operator]: "Operator",
  [SymbolKind.TypeParameter]: "TypeParameter",
};

export function getSymbolKindName(kind: SymbolKind): string {
  return SymbolKindNames[kind] || "Unknown";
}

export function parseSymbolKind(value: string): SymbolKind | undefined {
  const normalized = value.toLowerCase();
  for (const [kind, name] of Object.entries(SymbolKindNames)) {
    if (name.toLowerCase() === normalized) {
      return Number(kind) as SymbolKind;
    }
  }
  return undefined;
}
