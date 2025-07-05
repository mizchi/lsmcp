/**
 * High-level MCP analysis tools using symbol index
 */

import { z } from "zod";
import { SymbolKind } from "vscode-languageserver-types";
import type { ToolDef } from "../utils/mcpHelpers.ts";
import {
  getSymbolIndex,
  initializeSymbolIndex,
  indexFiles,
  querySymbols,
  getFileSymbols as getFileSymbolsFromIndex,
  getIndexStats,
  clearIndex,
  type SymbolQuery,
} from "./symbolIndex.ts";
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
  name: "index_files",
  description:
    "Build or update the symbol index for files matching the pattern. This enables fast symbol queries.",
  schema: indexFilesSchema,
  execute: async ({ pattern, root, concurrency }) => {
    const rootPath = root || process.cwd();
    const index = getSymbolIndex(rootPath);

    // Initialize if needed
    if (!getIndexStats(index).totalFiles) {
      await initializeSymbolIndex(index);
    }

    // Find files matching pattern
    const files = await glob(pattern, {
      cwd: rootPath,
      ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    });

    if (files.length === 0) {
      return `No files found matching pattern: ${pattern}`;
    }

    // Index files
    const startTime = Date.now();
    await indexFiles(index, files, concurrency);
    const duration = Date.now() - startTime;

    const stats = getIndexStats(index);
    return `Indexed ${files.length} files in ${duration}ms
Total files in index: ${stats.totalFiles}
Total symbols: ${stats.totalSymbols}`;
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

const findSymbolSchema = z.object({
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

export const findSymbolTool: ToolDef<typeof findSymbolSchema> = {
  name: "find_symbol",
  description:
    "Find symbols in the indexed codebase using various filters. Much faster than file-based search.",
  schema: findSymbolSchema,
  execute: async ({
    name,
    kind,
    file,
    containerName,
    includeChildren,
    root,
  }) => {
    const rootPath = root || process.cwd();
    const index = getSymbolIndex(rootPath);

    const stats = getIndexStats(index);
    if (stats.totalFiles === 0) {
      return "No files indexed. Please run index_files first.";
    }

    // Build query
    const query: SymbolQuery = {
      name,
      containerName,
      includeChildren,
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

    if (file) {
      query.file = file;
    }

    // Execute query
    const results = querySymbols(index, query);

    if (results.length === 0) {
      return "No symbols found matching the query.";
    }

    // Format results
    let output = `Found ${results.length} symbol(s):\n\n`;

    for (const symbol of results.slice(0, 50)) {
      // Limit to 50 results
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

// File analysis tools

const getFileSymbolsSchema = z.object({
  filePath: z
    .string()
    .describe("File path to get symbols for (relative to root)"),
  root: z.string().describe("Root directory for the project").optional(),
});

export const getFileSymbolsTool: ToolDef<typeof getFileSymbolsSchema> = {
  name: "get_file_symbols",
  description:
    "Get all symbols in a specific file from the index. Fast alternative to get_document_symbols.",
  schema: getFileSymbolsSchema,
  execute: async ({ filePath, root }) => {
    const rootPath = root || process.cwd();
    const index = getSymbolIndex(rootPath);

    const symbols = getFileSymbolsFromIndex(index, filePath);

    if (symbols.length === 0) {
      return `No symbols found in file: ${filePath}. The file may not be indexed yet.`;
    }

    // Format symbols hierarchically
    let output = `Symbols in ${filePath}:\n\n`;

    const formatSymbol = (symbol: any, indent: number = 0) => {
      const prefix = "  ".repeat(indent);
      const range = symbol.location.range;
      output += `${prefix}${symbol.name} [${symbolKindSchema.options[symbol.kind - 1]}]`;
      output += ` (${range.start.line + 1}:${range.start.character + 1})`;
      if (symbol.deprecated) {
        output += " deprecated";
      }
      output += "\n";

      if (symbol.children) {
        for (const child of symbol.children) {
          formatSymbol(child, indent + 1);
        }
      }
    };

    for (const symbol of symbols) {
      formatSymbol(symbol);
    }

    return output;
  },
};

// Statistics tool

const getIndexStatsSchema = z.object({
  root: z.string().describe("Root directory for the project").optional(),
});

export const getIndexStatsTool: ToolDef<typeof getIndexStatsSchema> = {
  name: "get_index_stats",
  description:
    "Get statistics about the symbol index including file count, symbol count, and performance metrics.",
  schema: getIndexStatsSchema,
  execute: async ({ root }) => {
    const rootPath = root || process.cwd();
    const index = getSymbolIndex(rootPath);

    const stats = getIndexStats(index);

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
  name: "clear_index",
  description:
    "Clear the symbol index and stop all file watchers. Use this to free memory or before re-indexing.",
  schema: clearIndexSchema,
  execute: async ({ root }) => {
    const rootPath = root || process.cwd();
    const index = getSymbolIndex(rootPath);

    const stats = getIndexStats(index);
    clearIndex(index);

    return `Cleared symbol index:
- Removed ${stats.totalFiles} files
- Removed ${stats.totalSymbols} symbols
- Stopped all file watchers`;
  },
};

// Export all analysis tools
export const analysisTools = [
  indexFilesTool,
  findSymbolTool,
  getFileSymbolsTool,
  getIndexStatsTool,
  clearIndexTool,
];
