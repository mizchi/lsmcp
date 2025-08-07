/**
 * MCP analysis tools using the new indexer implementation
 */

import { z } from "zod";
import type { ToolDef } from "../utils/mcpHelpers.ts";
import {
  clearIndex,
  forceClearIndex,
  indexFiles,
  querySymbols,
  getIndexStats,
  updateIndexIncremental,
  getOrCreateIndex,
} from "../../indexer/mcp/IndexerAdapter.ts";
import { glob } from "gitaware-glob";
import { relative } from "path";
import { fileURLToPath } from "url";
import {
  SYMBOL_KIND_NAMES,
  getSymbolKindName,
  parseSymbolKind,
} from "../../indexer/core/symbolKindTypes.ts";
import { getLSPClient } from "../../lsp/lspClient.ts";
import { loadIndexConfig } from "../../indexer/core/configLoader.ts";
import { getAdapterDefaultPattern } from "../../indexer/core/adapterDefaults.ts";

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

    // Find files matching pattern
    const filesIterator = await glob(pattern, {
      cwd: rootPath,
    });

    // Convert async iterator to array
    const files: string[] = [];
    for await (const file of filesIterator) {
      files.push(file);
    }

    if (files.length === 0) {
      return `No files found matching pattern: ${pattern}`;
    }

    // Debug: log files found
    console.error(
      `[index_files] Found ${files.length} files matching pattern ${pattern}`,
    );
    console.error(`[index_files] First few files:`, files.slice(0, 5));

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

// Accept string names for symbol kinds (case-insensitive)
const symbolKindSchema = z.enum(
  SYMBOL_KIND_NAMES as unknown as readonly [string, ...string[]],
);

const searchSymbolSchema = z.object({
  name: z
    .string()
    .describe("Symbol name to search for (supports partial matching)")
    .optional(),
  kind: z
    .union([symbolKindSchema, z.array(symbolKindSchema)])
    .describe(
      `Symbol kind(s) to filter by. Case-insensitive strings (e.g., 'Class', 'class', 'CLASS'). Valid kinds: ${SYMBOL_KIND_NAMES.join(", ")}`,
    )
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

export const searchSymbolFromIndexTool: ToolDef<typeof searchSymbolSchema> = {
  name: "search_symbol_from_index",
  description:
    "Search symbols in the indexed codebase using various filters. Much faster than file-based search when you need to search for symbols across many files. " +
    "Automatically updates the index with incremental changes before searching to ensure results are up-to-date. " +
    "Use 'kind' parameter with case-insensitive values like: File, Module, Namespace, Package, Class, Method, Property, Field, " +
    "Constructor, Enum, Interface, Function, Variable, Constant, String, Number, Boolean, Array, Object, Key, " +
    "Null, EnumMember, Struct, Event, Operator, TypeParameter.",
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
      // Auto-create index if it doesn't exist
      console.error(
        `[search_symbol_from_index] No index found. Creating initial index...`,
      );

      // Check if LSP client is initialized
      const client = getLSPClient();
      if (!client) {
        return `Error: LSP client not initialized. This usually means the MCP server was not started properly with a language server.`;
      }

      // Get or create index
      const index = getOrCreateIndex(rootPath);
      if (!index) {
        return `Error: Failed to create symbol index. LSP client may not be properly initialized.`;
      }

      // Determine pattern for initial indexing
      let pattern: string;
      const config = loadIndexConfig(rootPath);

      if (config?.indexFiles && config.indexFiles.length > 0) {
        pattern = config.indexFiles.join(",");
        console.error(
          `[search_symbol_from_index] Using patterns from .lsmcp/config.json: ${pattern}`,
        );
      } else {
        // Try to detect adapter and use its defaults
        pattern = getAdapterDefaultPattern("typescript");
        console.error(
          `[search_symbol_from_index] Using default TypeScript patterns: ${pattern}`,
        );
      }

      // Determine concurrency
      const concurrency = config?.settings?.indexConcurrency || 5;

      // Find files to index
      const files: string[] = [];
      const patterns = pattern.split(",").map((p) => p.trim());

      for (const p of patterns) {
        for await (const file of glob(p, { cwd: rootPath })) {
          if (typeof file === "string") {
            files.push(file);
          } else if (file && typeof file === "object" && "name" in file) {
            files.push((file as any).name);
          }
        }
      }

      if (files.length === 0) {
        return `No files found matching pattern: ${pattern}`;
      }

      console.error(
        `[search_symbol_from_index] Indexing ${files.length} files...`,
      );

      // Perform initial indexing
      const startTime = Date.now();
      await index.indexFiles(files, concurrency, {
        onProgress: (progress: any) => {
          if (
            progress.completed % 10 === 0 ||
            progress.completed === progress.total
          ) {
            console.error(
              `[search_symbol_from_index] Progress: ${progress.completed}/${progress.total} files`,
            );
          }
        },
      });

      const stats = index.getStats();
      const duration = Date.now() - startTime;
      console.error(
        `[search_symbol_from_index] Initial indexing completed: ${stats.totalFiles} files, ${stats.totalSymbols} symbols in ${duration}ms`,
      );
    } else {
      // Auto-update index with incremental changes if it already exists
      try {
        const updateResult = await updateIndexIncremental(rootPath);
        if (updateResult.success) {
          const updatedCount = updateResult.updated.length;
          const removedCount = updateResult.removed.length;
          if (updatedCount > 0 || removedCount > 0) {
            console.error(
              `[search_symbol_from_index] Auto-updated index: ${updatedCount} files updated, ${removedCount} files removed`,
            );
          }
        }
      } catch (error) {
        // Log error but continue with search
        console.error(
          `[search_symbol_from_index] Failed to auto-update index: ${error}`,
        );
      }
    }

    // Build query
    const query: any = {
      name,
      containerName,
      includeChildren,
      file,
    };

    // Use the parseSymbolKind function to handle case-insensitive strings
    if (kind) {
      try {
        const parsedKinds = parseSymbolKind(kind);
        query.kind =
          parsedKinds && parsedKinds.length === 1
            ? parsedKinds[0]
            : parsedKinds;
      } catch (error) {
        // Provide helpful error message
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return (
          `Error parsing symbol kind: ${errorMessage}

` +
          `Valid values (case-insensitive): ${SYMBOL_KIND_NAMES.join(", ")}

` +
          `Examples:
` +
          `  - { "kind": "Class" }
` +
          `  - { "kind": "class" }  // Case-insensitive
` +
          `  - { "kind": ["Class", "Interface", "Function"] }
` +
          `  - { "kind": ["CLASS", "interface", "FUNCTION"] }  // Mixed case works`
        );
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
      const kindName =
        getSymbolKindName(symbol.kind) || `Unknown(${symbol.kind})`;

      output += `${symbol.name} [${kindName}]`;
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

export const getIndexStatsFromIndexTool: ToolDef<typeof getIndexStatsSchema> = {
  name: "get_index_stats_from_index",
  description:
    "Get statistics about the symbol index including file count, symbol count, and performance metrics. " +
    "This shows information about the pre-built index used for fast symbol searches.",
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
  force: z
    .boolean()
    .default(false)
    .describe(
      "Force clear all caches including SQLite cache. Use this to completely reset the index.",
    ),
});

export const clearIndexTool: ToolDef<typeof clearIndexSchema> = {
  name: "clear_index",
  description:
    "Clear the symbol index and stop all file watchers. Use this to free memory or before re-indexing. " +
    "Use force=true to completely reset the index including all caches.",
  schema: clearIndexSchema,
  execute: async ({ root, force }) => {
    const rootPath = root || process.cwd();
    const stats = getIndexStats(rootPath);

    if (force) {
      await forceClearIndex(rootPath);
      return `Force cleared symbol index:
- Removed ${stats.totalFiles} files
- Removed ${stats.totalSymbols} symbols
- Cleared all caches
- Reset all watchers`;
    } else {
      clearIndex(rootPath);
      return `Cleared symbol index:
- Removed ${stats.totalFiles} files
- Removed ${stats.totalSymbols} symbols
- Stopped all file watchers`;
    }
  },
};

// Incremental update tool
const updateIndexIncrementalSchema = z.object({
  root: z.string().describe("Root directory for the project").optional(),
});

export const updateIndexIncrementalTool: ToolDef<
  typeof updateIndexIncrementalSchema
> = {
  name: "update_index_from_index",
  description:
    "Update symbol index incrementally based on git changes. Only re-indexes modified files. " +
    "This is faster than full re-indexing and should be used after making code changes.",
  schema: updateIndexIncrementalSchema,
  execute: async ({ root }) => {
    const rootPath = root || process.cwd();
    const result = await updateIndexIncremental(rootPath);

    if (!result.success) {
      return `Failed to update index incrementally: ${result.message || result.errors.join(", ")}`;
    }

    let output = `Incremental index update completed:\n`;

    if (result.updated.length > 0) {
      output += `\nUpdated files (${result.updated.length}):\n`;
      result.updated.forEach((file) => {
        output += `  - ${file}\n`;
      });
    }

    if (result.removed.length > 0) {
      output += `\nRemoved files (${result.removed.length}):\n`;
      result.removed.forEach((file) => {
        output += `  - ${file}\n`;
      });
    }

    if (result.errors.length > 0) {
      output += `\nErrors (${result.errors.length}):\n`;
      result.errors.forEach((error) => {
        output += `  - ${error}\n`;
      });
    }

    if (result.updated.length === 0 && result.removed.length === 0) {
      output += "\nNo changes detected.";
    }

    return output;
  },
};

// Import unified tool
import { indexSymbolsTool } from "./indexToolsUnified.ts";
import { getProjectOverviewTool } from "./projectOverview.ts";

// Export index tools - now includes the unified index_symbols tool
export const indexTools = [
  getProjectOverviewTool, // Quick project overview
  indexSymbolsTool, // New unified tool that replaces index_files and update_index_from_index
  searchSymbolFromIndexTool,
  getIndexStatsFromIndexTool,
  clearIndexTool,
  // updateIndexIncrementalTool, // Removed - functionality merged into indexSymbolsTool
  // indexFilesTool, // Removed - replaced by indexSymbolsTool
];
