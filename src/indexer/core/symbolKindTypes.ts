/**
 * Symbol kind constants and utilities
 */

import { SymbolKind } from "vscode-languageserver-types";

// Export the SymbolKind enum values as constants for easier access
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
 * Get a formatted list of all symbol kinds for documentation
 */
export function getSymbolKindsList(): string {
  return SYMBOL_KIND_NAMES.map((name) => `${SYMBOL_KINDS[name]}: ${name}`).join(
    ", ",
  );
}
