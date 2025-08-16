/**
 * MCP analysis tools using the new indexer implementation
 */

import { z } from "zod";
import type { McpToolDef, McpContext } from "@internal/types";
import { debugLogWithPrefix } from "../../utils/debugLog.ts";
import {
  querySymbols,
  getIndexStats,
  updateIndexIncremental,
  getOrCreateIndex,
} from "@internal/code-indexer";
import { glob } from "gitaware-glob";
import { relative } from "path";
import { fileURLToPath } from "url";
import {
  SYMBOL_KIND_NAMES,
  getSymbolKindName,
  parseSymbolKind,
} from "@internal/code-indexer";
// Remove getLSPClient - no longer needed
import { loadIndexConfig } from "@internal/code-indexer";
import { getAdapterDefaultPattern } from "@internal/code-indexer";

// Index management tools removed - now using internal functions from @internal/code-indexer

// indexFilesTool removed - replaced by automatic indexing in search and overview tools

// Symbol query tools

// Accept string names for symbol kinds (case-insensitive)
// Also accept numbers, arrays, and JSON-encoded arrays
const searchSymbolSchema = z.object({
  query: z
    .string()
    .describe(
      "Symbol name or pattern to search for (supports partial matching)",
    )
    .optional(),
  name: z
    .string()
    .describe(
      "Symbol name to search for (alias for query, supports partial matching)",
    )
    .optional(),
  kind: z
    .any()
    .describe(
      `Symbol kind(s) to filter by. Accepts: string (e.g., 'Class'), array (e.g., ['Class', 'Interface']), number (e.g., 5), or JSON string (e.g., '["Class", "Interface"]'). Case-insensitive. Valid kinds: ${SYMBOL_KIND_NAMES.join(", ")}. If not specified, searches all symbol kinds.`,
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
  includeExternal: z
    .boolean()
    .default(false)
    .describe(
      "Include external library symbols (from node_modules) in results",
    ),
  onlyExternal: z
    .boolean()
    .default(false)
    .describe("Only return external library symbols"),
  sourceLibrary: z
    .string()
    .describe(
      "Filter by specific library name (e.g., 'neverthrow', '@types/node')",
    )
    .optional(),
  root: z.string().describe("Root directory for the project").optional(),
});

export const searchSymbolsTool: McpToolDef<typeof searchSymbolSchema> = {
  name: "search_symbols",
  description:
    "Search for symbols (functions, classes, variables, etc.) in the codebase using an indexed search. " +
    "Automatically creates and updates the symbol index as needed for fast searching across many files. " +
    "Provides fuzzy name matching and guides you to use specific LSP tools for detailed operations. " +
    "Use 'kind' parameter with case-insensitive values like: File, Module, Namespace, Package, Class, Method, Property, Field, " +
    "Constructor, Enum, Interface, Function, Variable, Constant, String, Number, Boolean, Array, Object, Key, " +
    "Null, EnumMember, Struct, Event, Operator, TypeParameter.",
  schema: searchSymbolSchema,
  execute: async (
    {
      query,
      name,
      kind,
      file,
      containerName,
      includeChildren,
      includeExternal,
      onlyExternal,
      sourceLibrary,
      root,
    },
    context?: McpContext,
  ) => {
    const rootPath = root || process.cwd();

    // Get index stats first
    const stats = getIndexStats(rootPath);
    if (stats.totalFiles === 0) {
      // Auto-create index if it doesn't exist
      debugLogWithPrefix(
        "search_symbol_from_index",
        "No index found. Creating initial index...",
      );

      // Check if LSP client is initialized
      // Get or create index
      // Pass context which includes fs (FileSystemApi) and lspClient
      const index = getOrCreateIndex(rootPath, context);
      if (!index) {
        return `Error: Failed to create symbol index. LSP client may not be properly initialized.`;
      }

      // Determine pattern for initial indexing
      let pattern: string;
      const config = loadIndexConfig(rootPath);

      // Priority: 1. files from config, 2. files from context, 3. preset defaults, 4. empty (no auto-indexing)
      if (config?.files && config.files.length > 0) {
        pattern = config.files.join(",");
        debugLogWithPrefix(
          "search_symbol_from_index",
          `Using patterns from config.files: ${pattern}`,
        );
      } else if (
        context?.config?.files &&
        Array.isArray(context.config.files)
      ) {
        // Check if files are provided in context (from preset)
        pattern = (context.config.files as string[]).join(",");
        debugLogWithPrefix(
          "search_symbol_from_index",
          `Using patterns from context.config.files: ${pattern}`,
        );
      } else if (context?.config?.preset) {
        // Use preset-specific patterns
        const presetId = context.config.preset as string;
        pattern = getAdapterDefaultPattern(presetId);
        if (!pattern) {
          // Preset not found or has no default patterns
          debugLogWithPrefix(
            "search_symbol_from_index",
            `Unknown preset '${presetId}' or preset has no default patterns`,
          );
          return `Unknown preset '${presetId}' or preset has no default patterns. Please specify 'files' in your .lsmcp/config.json`;
        }
        debugLogWithPrefix(
          "search_symbol_from_index",
          `Using patterns from preset '${presetId}': ${pattern}`,
        );
      } else {
        // No preset or files configured - don't auto-index
        debugLogWithPrefix(
          "search_symbol_from_index",
          "No file patterns configured. Please specify 'files' or 'preset' in config.",
        );
        return "No file patterns configured. Please specify 'files' or 'preset' in your .lsmcp/config.json";
      }

      // Determine concurrency
      const concurrency = config?.settings?.indexConcurrency || 5;

      // Find files to index
      const files: string[] = [];
      // Handle patterns with braces properly (e.g., **/*.{ts,tsx})
      const patterns =
        pattern.includes("{") && pattern.includes("}")
          ? [pattern]
          : pattern.split(",").map((p) => p.trim());

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

      debugLogWithPrefix(
        "search_symbol_from_index",
        `Indexing ${files.length} files...`,
      );

      // Perform initial indexing
      const startTime = Date.now();
      await index.indexFiles(files, concurrency, {
        onProgress: (progress: any) => {
          if (
            progress.completed % 10 === 0 ||
            progress.completed === progress.total
          ) {
            debugLogWithPrefix(
              "search_symbol_from_index",
              `Progress: ${progress.completed}/${progress.total} files`,
            );
          }
        },
      });

      const stats = index.getStats();
      const duration = Date.now() - startTime;
      debugLogWithPrefix(
        "search_symbol_from_index",
        `Initial indexing completed: ${stats.totalFiles} files, ${stats.totalSymbols} symbols in ${duration}ms`,
      );
    } else {
      // Auto-update index with incremental changes if it already exists
      try {
        // Always pass context (which may be undefined)
        const updateResult = await updateIndexIncremental(rootPath, context);
        if (updateResult.success) {
          const updatedCount = updateResult.updated.length;
          const removedCount = updateResult.removed.length;
          if (updatedCount > 0 || removedCount > 0) {
            debugLogWithPrefix(
              "search_symbol_from_index",
              `Auto-updated index: ${updatedCount} files updated, ${removedCount} files removed`,
            );
          }
        }
      } catch (error) {
        // Log error but continue with search
        debugLogWithPrefix(
          "search_symbol_from_index",
          `Failed to auto-update index: ${error}`,
        );
      }
    }

    // Build query (use 'query' parameter as alias for 'name')
    const searchQuery: any = {
      name: name || query, // Support both 'name' and 'query' parameters
      containerName,
      includeChildren,
      file,
      includeExternal,
      onlyExternal,
      sourceLibrary,
    };

    // Use the parseSymbolKind function to handle case-insensitive strings
    // If kind is not specified, search all symbol kinds
    if (kind !== undefined && kind !== null && kind !== "") {
      try {
        const parsedKinds = parseSymbolKind(kind);
        searchQuery.kind =
          parsedKinds && parsedKinds.length === 1
            ? parsedKinds[0]
            : parsedKinds;
      } catch (error) {
        // Provide helpful error message
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return `Error: ${errorMessage}

Valid symbol kinds (case-insensitive):
${SYMBOL_KIND_NAMES.join(", ")}

Examples:
  • Single kind: "Class" or "class" or "CLASS"
  • Multiple kinds: ["Class", "Interface", "Function"]
  • Numeric kinds: 5 (for Class) or [5, 11, 12] (for Class, Interface, Function)
  • JSON string: "[\"Class\", \"Interface\"]"
  • Empty/undefined: Search all symbol kinds`;
      }
    }
    // If kind is not specified, don't set it in searchQuery to search all kinds

    // Execute query
    const results = querySymbols(rootPath, searchQuery);

    if (results.length === 0) {
      return "No symbols found matching the query.";
    }

    // Format results with LSP tool guidance
    let output = `Found ${results.length} symbol(s) matching your search:\n\n`;

    // Show up to 10 results with detailed guidance
    const displayCount = Math.min(results.length, 10);

    for (let i = 0; i < displayCount; i++) {
      const symbol = results[i];
      const filePath = fileURLToPath(symbol.location.uri);
      const relativePath = relative(rootPath, filePath);
      const range = symbol.location.range;
      const kindName =
        getSymbolKindName(symbol.kind) || `Unknown(${symbol.kind})`;
      const line = range.start.line + 1;
      const column = range.start.character + 1;

      output += `${i + 1}. ${symbol.name} [${kindName}]`;
      if (symbol.containerName) {
        output += ` in ${symbol.containerName}`;
      }
      if (symbol.deprecated) {
        output += " (deprecated)";
      }
      output += `\n`;
      output += `   Location: ${relativePath}:${line}:${column}\n`;

      if (symbol.detail) {
        output += `   Details: ${symbol.detail}\n`;
      }

      // Add tool guidance with get_symbol_details as primary recommendation
      output += `\n   Use get_symbol_details for comprehensive information:\n`;
      output += `   • mcp__lsmcp__get_symbol_details --root "${rootPath}" --relativePath "${relativePath}" --line ${line} --symbol "${symbol.name}"\n`;
      output += `\n   Or use specific LSP tools for targeted operations:\n`;
      output += `   • View definition: lsp_get_definitions --root "${rootPath}" --relativePath "${relativePath}" --line ${line} --symbolName "${symbol.name}" --includeBody true\n`;
      output += `   • Rename symbol: lsp_rename_symbol --root "${rootPath}" --relativePath "${relativePath}" --line ${line} --textTarget "${symbol.name}" --newName "NEW_NAME"\n`;
      output += `\n`;
    }

    if (results.length > displayCount) {
      output += `\n... and ${results.length - displayCount} more results.\n`;
      output += `Refine your search with more specific criteria (name, kind, or file pattern) to see more relevant results.`;
    }

    return output;
  },
};

// clearIndexTool removed - now using internal functions from @internal/code-indexer directly

// updateIndexIncrementalTool removed - functionality is now internal to search and overview tools

import { getProjectOverviewTool } from "./projectOverview.ts";
import { createGetSymbolDetailsTool } from "./getSymbolDetails.ts";

// Export index tools - only user-facing tools
export const indexTools = [
  getProjectOverviewTool, // Quick project overview with statistics
  searchSymbolsTool, // Unified symbol search tool (combines search_symbol_from_index, find_symbols, query_symbols)
];

// Export function to create symbol details tool with LSP client
export { createGetSymbolDetailsTool };
