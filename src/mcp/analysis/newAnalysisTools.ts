/**
 * MCP analysis tools using the new indexer implementation
 */

import { z } from "zod";
import { SymbolKind } from "vscode-languageserver-types";
import type { ToolDef } from "../utils/mcpHelpers.ts";
import {
  clearIndex,
  indexFiles,
  querySymbols,
  getIndexStats,
} from "../../indexer/mcp/IndexerAdapter.ts";
import { glob } from "glob";
import { relative } from "path";
import { fileURLToPath } from "url";

// Index management tools

const indexFilesSchema = z.object({
  pattern: z
    .string()
    .describe(
      "Glob pattern for files to index (e.g., '**/*.ts', 'src/**/*.{js,jsx}')",
    ),
  root: z.string().describe("Root directory for the project").optional(),
  concurrency: z
    .number()
    .min(1)
    .max(20)
    .default(5)
    .describe("Number of files to index in parallel"),
});

export const indexFilesTool: ToolDef<typeof indexFilesSchema> = {
  name: "new_index_files",
  description:
    "Build or update the symbol index for files matching the pattern. This enables fast symbol queries.",
  schema: indexFilesSchema,
  execute: async ({ pattern, root, concurrency }) => {
    const rootPath = root || process.cwd();

    // Find files matching pattern
    const files = await glob(pattern, {
      cwd: rootPath,
      ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    });

    if (files.length === 0) {
      return `No files found matching pattern: ${pattern}`;
    }

    // Index files
    const result = await indexFiles(rootPath, files, { concurrency });

    let output = `Indexed ${files.length} files in ${result.duration}ms
Total files in index: ${result.totalFiles}
Total symbols: ${result.totalSymbols}`;

    if (result.errors.length > 0) {
      output += `\n\nErrors encountered:\n`;
      result.errors.slice(0, 10).forEach((err) => {
        output += `  ${err.file}: ${err.error}\n`;
      });
      if (result.errors.length > 10) {
        output += `  ... and ${result.errors.length - 10} more errors`;
      }
    }

    return output;
  },
};

// Symbol query tools

const symbolKindSchema = z.enum([
  "File",
  "Module",
  "Namespace",
  "Package",
  "Class",
  "Method",
  "Property",
  "Field",
  "Constructor",
  "Enum",
  "Interface",
  "Function",
  "Variable",
  "Constant",
  "String",
  "Number",
  "Boolean",
  "Array",
  "Object",
  "Key",
  "Null",
  "EnumMember",
  "Struct",
  "Event",
  "Operator",
  "TypeParameter",
]);

const searchSymbolSchema = z.object({
  name: z
    .string()
    .describe("Symbol name to search for (supports partial matching)")
    .optional(),
  kind: z
    .union([symbolKindSchema, z.array(symbolKindSchema)])
    .describe("Symbol kind(s) to filter by")
    .optional(),
  file: z
    .string()
    .describe("File path to search within (relative to root)")
    .optional(),
  containerName: z
    .string()
    .describe("Container name (e.g., class name for methods)")
    .optional(),
  includeChildren: z
    .boolean()
    .default(true)
    .describe("Include child symbols in results"),
  root: z.string().describe("Root directory for the project").optional(),
});

export const searchSymbolTool: ToolDef<typeof searchSymbolSchema> = {
  name: "new_search_symbol",
  description:
    "Search symbols in the indexed codebase using various filters. Much faster than file-based search.",
  schema: searchSymbolSchema,
  execute: async ({
    name,
    kind,
    file,
    containerName,
    includeChildren,
    root,
  }) => {
    const rootPath = root || process.cwd();

    // Get index stats first
    const stats = getIndexStats(rootPath);
    if (stats.totalFiles === 0) {
      return "No files indexed. Please run index_files first.";
    }

    // Build query
    const query: any = {
      name,
      containerName,
      includeChildren,
      file,
    };

    if (kind) {
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

      if (Array.isArray(kind)) {
        query.kind = kind.map((k) => kindMap[k]);
      } else {
        query.kind = kindMap[kind];
      }
    }

    // Execute query
    const results = querySymbols(rootPath, query);

    if (results.length === 0) {
      return "No symbols found matching the query.";
    }

    // Format results
    let output = `Found ${results.length} symbol(s):\n\n`;

    for (const symbol of results.slice(0, 50)) {
      const filePath = fileURLToPath(symbol.location.uri);
      const relativePath = relative(rootPath, filePath);
      const range = symbol.location.range;

      output += `${symbol.name} [${symbolKindSchema.options[symbol.kind - 1]}]`;
      if (symbol.containerName) {
        output += ` in ${symbol.containerName}`;
      }
      if (symbol.deprecated) {
        output += " (deprecated)";
      }
      output += `\n  ${relativePath}:${range.start.line + 1}:${range.start.character + 1}\n`;
      if (symbol.detail) {
        output += `  ${symbol.detail}\n`;
      }
      output += "\n";
    }

    if (results.length > 50) {
      output += `\n... and ${results.length - 50} more results`;
    }

    return output;
  },
};

// Statistics tool

const getIndexStatsSchema = z.object({
  root: z.string().describe("Root directory for the project").optional(),
});

export const getIndexStatsTool: ToolDef<typeof getIndexStatsSchema> = {
  name: "new_get_index_stats",
  description:
    "Get statistics about the symbol index including file count, symbol count, and performance metrics.",
  schema: getIndexStatsSchema,
  execute: async ({ root }) => {
    const rootPath = root || process.cwd();
    const stats = getIndexStats(rootPath);

    return `Symbol Index Statistics:
- Total files indexed: ${stats.totalFiles}
- Total symbols: ${stats.totalSymbols}
- Total indexing time: ${stats.indexingTime}ms
- Average time per file: ${stats.totalFiles > 0 ? Math.round(stats.indexingTime / stats.totalFiles) : 0}ms
- Last updated: ${stats.lastUpdated.toISOString()}`;
  },
};

// Clear index tool

const clearIndexSchema = z.object({
  root: z.string().describe("Root directory for the project").optional(),
});

export const clearIndexTool: ToolDef<typeof clearIndexSchema> = {
  name: "new_clear_index",
  description:
    "Clear the symbol index and stop all file watchers. Use this to free memory or before re-indexing.",
  schema: clearIndexSchema,
  execute: async ({ root }) => {
    const rootPath = root || process.cwd();
    const stats = getIndexStats(rootPath);

    clearIndex(rootPath);

    return `Cleared symbol index:
- Removed ${stats.totalFiles} files
- Removed ${stats.totalSymbols} symbols
- Stopped all file watchers`;
  },
};

// Export new analysis tools
export const newAnalysisTools = [
  indexFilesTool,
  searchSymbolTool,
  getIndexStatsTool,
  clearIndexTool,
];
