import { SymbolKind } from "vscode-languageserver-types";

// Symbol-related types for the indexer and symbol operations

// Re-export SymbolKind for convenience
export { SymbolKind } from "vscode-languageserver-types";

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

// Symbol kind constants for easier access
export const SYMBOL_KINDS = {
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
} as const;

export type SymbolKindName = keyof typeof SYMBOL_KINDS;

export const SYMBOL_KIND_NAMES: SymbolKindName[] = Object.keys(
  SYMBOL_KINDS,
) as SymbolKindName[];

// Legacy name mapping for backward compatibility
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

/**
 * Get the display name for a symbol kind
 */
export function getSymbolKindName(
  kind: SymbolKind,
): SymbolKindName | undefined {
  const entry = Object.entries(SYMBOL_KINDS).find(
    ([_, value]) => value === kind,
  );
  return entry ? (entry[0] as SymbolKindName) : undefined;
}

/**
 * Parse symbol kind input (string or array of strings) to SymbolKind values
 * Accepts string values with case-insensitive matching (e.g., "Class", "class", "CLASS")
 */
export function parseSymbolKind(
  input: string | string[] | number | number[] | undefined,
): SymbolKind[] | undefined {
  if (input === undefined || input === null) return undefined;

  // Handle JSON-encoded arrays
  if (typeof input === "string") {
    // Try to parse as JSON array first
    if (input.startsWith("[") && input.endsWith("]")) {
      try {
        const parsed = JSON.parse(input);
        if (Array.isArray(parsed)) {
          input = parsed;
        }
      } catch {
        // Not valid JSON, treat as single string
      }
    }
  }

  // Convert to array if not already
  const kinds = Array.isArray(input) ? input : [input];

  return kinds.map((k) => {
    // Handle numeric symbol kinds
    if (typeof k === "number") {
      // Validate that the number is a valid SymbolKind
      if (Object.values(SymbolKind).includes(k as any)) {
        return k as SymbolKind;
      }
      throw new Error(
        `Invalid symbol kind number: ${k}. Valid range is 1-26.`,
      );
    }

    if (typeof k !== "string") {
      throw new Error(`Invalid kind type: ${typeof k}. Expected string or number.`);
    }

    // Case-insensitive matching - find exact match regardless of case
    const kindName = SYMBOL_KIND_NAMES.find(
      (name) => name.toLowerCase() === k.toLowerCase(),
    );

    if (kindName) {
      return SYMBOL_KINDS[kindName];
    }

    throw new Error(
      `Unknown symbol kind: "${k}". Valid options: ${SYMBOL_KIND_NAMES.join(", ")}`,
    );
  });
}

/**
 * Get a formatted list of all symbol kinds for documentation
 */
export function getSymbolKindsList(): string {
  return SYMBOL_KIND_NAMES.map((name) => `${SYMBOL_KINDS[name]}: ${name}`).join(
    ", ",
  );
}
