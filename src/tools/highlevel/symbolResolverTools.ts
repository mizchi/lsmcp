/**
 * MCP tools for symbol resolution
 */

import type { McpToolDef } from "@internal/types";
import { z } from "zod";
import { resolve } from "path";
import { readFile } from "fs/promises";
import { uriToPath } from "../../utils/uriHelpers.ts";
import {
  getAvailableExternalSymbols,
  parseImports,
  resolveModulePath,
  getSymbolKindName,
} from "@internal/code-indexer";

/**
 * Tool: Resolve symbol from imports
 */
export const resolveSymbolToolDef: McpToolDef<any> = {
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
export const getAvailableExternalSymbolsToolDef: McpToolDef<any> = {
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
export const parseImportsToolDef: McpToolDef<any> = {
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

  // Use getAvailableExternalSymbols instead of resolveSymbolFromImports
  // This avoids the need for LSP client parameter which is not available in MCP context
  // The trade-off is that we get placeholder symbol information rather than full LSP data
  const availableSymbols = await getAvailableExternalSymbols(
    fullPath,
    rootPath,
  );
  const resolution = availableSymbols.get(parsed.symbolName);

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
        location: uriToPath(resolution.symbol.location.uri),
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
