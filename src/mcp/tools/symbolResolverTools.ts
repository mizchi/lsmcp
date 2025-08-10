/**
 * MCP tools for symbol resolution
 */

import type { ToolDef } from "../utils/mcpHelpers.ts";
import { z } from "zod";
import { resolve } from "path";
import { getLSPClient } from "../../lsp/lspClient.ts";
import {
  resolveSymbolFromImports,
  getAvailableExternalSymbols,
  parseImports,
  resolveModulePath,
} from "../../indexer/providers/symbolResolver.ts";

/**
 * Tool: Resolve symbol from imports
 */
export const resolveSymbolToolDef: ToolDef<any> = {
  name: "resolve_symbol",
  description: `Resolve a symbol to its definition in external libraries by analyzing import statements.
For example, if a file imports { ok, Ok, Err } from 'neverthrow', this tool can resolve where these symbols are defined.`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    filePath: z
      .string()
      .describe("File path containing the symbol (relative to root)"),
    symbolName: z
      .string()
      .describe("Name of the symbol to resolve (e.g., 'ok', 'Ok', 'Err')"),
  }),
  execute: handleResolveSymbol,
};

/**
 * Tool: Get available external symbols
 */
export const getAvailableExternalSymbolsToolDef: ToolDef<any> = {
  name: "get_available_external_symbols",
  description: `Get all symbols available from external libraries imported in a file.
Shows what symbols are imported and from which modules they come from.`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    filePath: z.string().describe("File path to analyze (relative to root)"),
  }),
  execute: handleGetAvailableExternalSymbols,
};

/**
 * Tool: Parse imports from file
 */
export const parseImportsToolDef: ToolDef<any> = {
  name: "parse_imports",
  description: `Parse and analyze import statements in a TypeScript/JavaScript file.
Shows all imports, their sources, and any aliases used.`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    filePath: z.string().describe("File path to analyze (relative to root)"),
  }),
  execute: handleParseImports,
};

/**
 * Handle resolve_symbol tool
 */
async function handleResolveSymbol(args: any) {
  const schema = z.object({
    root: z.string(),
    filePath: z.string(),
    symbolName: z.string(),
  });

  const parsed = schema.parse(args);
  const rootPath = resolve(parsed.root);
  const fullPath = resolve(rootPath, parsed.filePath);

  const client = getLSPClient();
  if (!client) {
    throw new Error("LSP client not initialized");
  }

  const resolution = await resolveSymbolFromImports(
    parsed.symbolName,
    fullPath,
    rootPath,
    client,
  );

  if (!resolution) {
    return JSON.stringify(
      {
        error: `Symbol '${parsed.symbolName}' not found in imports or could not be resolved`,
      },
      null,
      2,
    );
  }

  return JSON.stringify(
    {
      symbolName: parsed.symbolName,
      sourceModule: resolution.sourceModule,
      resolvedPath: resolution.resolvedPath,
      symbol: {
        name: resolution.symbol.name,
        kind: getSymbolKindName(resolution.symbol.kind),
        location: resolution.symbol.location.uri.replace("file://", ""),
        detail: resolution.symbol.detail,
      },
    },
    null,
    2,
  );
}

/**
 * Handle get_available_external_symbols tool
 */
async function handleGetAvailableExternalSymbols(args: any) {
  const schema = z.object({
    root: z.string(),
    filePath: z.string(),
  });

  const parsed = schema.parse(args);
  const rootPath = resolve(parsed.root);
  const fullPath = resolve(rootPath, parsed.filePath);

  const availableSymbols = await getAvailableExternalSymbols(
    fullPath,
    rootPath,
  );

  const symbols = Array.from(availableSymbols.entries()).map(
    ([local, resolution]) => ({
      localName: local,
      importedName: resolution.symbol.name,
      sourceModule: resolution.sourceModule,
      resolvedPath: resolution.resolvedPath,
    }),
  );

  return JSON.stringify(
    {
      file: parsed.filePath,
      totalSymbols: symbols.length,
      symbols,
    },
    null,
    2,
  );
}

/**
 * Handle parse_imports tool
 */
async function handleParseImports(args: any) {
  const schema = z.object({
    root: z.string(),
    filePath: z.string(),
  });

  const parsed = schema.parse(args);
  const rootPath = resolve(parsed.root);
  const fullPath = resolve(rootPath, parsed.filePath);

  const { readFile } = await import("fs/promises");
  const sourceCode = await readFile(fullPath, "utf-8");
  const imports = parseImports(sourceCode);

  // Enhance imports with resolved paths
  const enhancedImports = imports.map((imp) => {
    const resolvedPath = resolveModulePath(imp.source, fullPath, rootPath);
    return {
      source: imp.source,
      resolvedPath,
      isTypeOnly: imp.isTypeOnly,
      specifiers: imp.specifiers.map((spec) => ({
        imported: spec.imported,
        local: spec.local,
        isDefault: spec.isDefault,
        isNamespace: spec.isNamespace,
      })),
    };
  });

  return JSON.stringify(
    {
      file: parsed.filePath,
      totalImports: enhancedImports.length,
      imports: enhancedImports,
    },
    null,
    2,
  );
}

/**
 * Get human-readable symbol kind name
 */
function getSymbolKindName(kind: number): string {
  const kindNames: Record<number, string> = {
    1: "File",
    2: "Module",
    3: "Namespace",
    4: "Package",
    5: "Class",
    6: "Method",
    7: "Property",
    8: "Field",
    9: "Constructor",
    10: "Enum",
    11: "Interface",
    12: "Function",
    13: "Variable",
    14: "Constant",
    15: "String",
    16: "Number",
    17: "Boolean",
    18: "Array",
    19: "Object",
    20: "Key",
    21: "Null",
    22: "EnumMember",
    23: "Struct",
    24: "Event",
    25: "Operator",
    26: "TypeParameter",
  };
  return kindNames[kind] || "Unknown";
}
