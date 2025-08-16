/**
 * High-level symbol search tool that provides AI-friendly output with LSP tool guidance
 */

import { z } from "zod";
import type { McpToolDef, McpContext } from "@internal/types";
import { debugLogWithPrefix } from "../../utils/debugLog.ts";
import {
  getOrCreateIndex,
  querySymbols,
  getIndexStats,
  updateIndexIncremental,
  loadIndexConfig,
  getAdapterDefaultPattern,
  SYMBOL_KIND_NAMES,
  parseSymbolKind,
  getSymbolKindName,
} from "@internal/code-indexer";
import { glob } from "gitaware-glob";
import { relative } from "path";
import { fileURLToPath } from "url";

// Custom schema that accepts case-insensitive kind names
const symbolKindSchema = z.string().transform((val) => {
  // Normalize to proper case (e.g., "class" -> "Class", "INTERFACE" -> "Interface")
  const normalized = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
  // Check if it's a valid kind
  if (!SYMBOL_KIND_NAMES.includes(normalized as any)) {
    throw new Error(`Invalid symbol kind: ${val}`);
  }
  return normalized;
});

const findSymbolsSchema = z.object({
  query: z
    .string()
    .describe(
      "Symbol name or pattern to search for (supports partial matching)",
    )
    .optional(),
  kind: z
    .union([symbolKindSchema, z.array(symbolKindSchema)])
    .describe(
      `Symbol type to filter by (e.g., 'Class', 'Function', 'Interface'). Case-insensitive.`,
    )
    .optional(),
  file: z.string().describe("File path pattern to search within").optional(),
  includeExternal: z
    .boolean()
    .default(false)
    .describe("Include symbols from external libraries (node_modules)"),
  root: z.string().describe("Root directory for the project").optional(),
});

export const findSymbolsTool: McpToolDef<typeof findSymbolsSchema> = {
  name: "find_symbols",
  description:
    "Search for symbols (functions, classes, variables, etc.) in the codebase. " +
    "This high-level tool provides fuzzy search capabilities and guides you to use specific LSP tools for detailed operations. " +
    "Automatically creates and updates the symbol index as needed.",
  schema: findSymbolsSchema,
  execute: async (
    { query, kind, file, includeExternal, root },
    context?: McpContext,
  ) => {
    const rootPath = root || process.cwd();

    // Auto-create or update index
    const stats = getIndexStats(rootPath);
    if (stats.totalFiles === 0) {
      // Auto-create index if it doesn't exist
      debugLogWithPrefix("find_symbols", "Creating initial index...");

      const index = getOrCreateIndex(rootPath, context);
      if (!index) {
        return `Error: Failed to create symbol index. LSP client may not be properly initialized.`;
      }

      // Determine pattern for initial indexing
      let pattern: string;
      const config = loadIndexConfig(rootPath);

      if (config?.files && config.files.length > 0) {
        pattern = config.files.join(",");
      } else if (
        context?.config?.files &&
        Array.isArray(context.config.files)
      ) {
        pattern = (context.config.files as string[]).join(",");
      } else if (context?.config?.preset) {
        const presetId = context.config.preset as string;
        pattern = getAdapterDefaultPattern(presetId);
        if (!pattern) {
          return `Unknown preset '${presetId}'. Please specify 'files' in your .lsmcp/config.json`;
        }
      } else {
        return "No file patterns configured. Please specify 'files' or 'preset' in your .lsmcp/config.json";
      }

      // Find and index files
      const files: string[] = [];
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

      const concurrency = config?.settings?.indexConcurrency || 5;
      await index.indexFiles(files, concurrency);
    } else {
      // Auto-update index
      try {
        await updateIndexIncremental(rootPath, context);
      } catch (error) {
        debugLogWithPrefix(
          "find_symbols",
          `Failed to auto-update index: ${error}`,
        );
      }
    }

    // Build query
    const searchQuery: any = {
      name: query,
      file,
      includeExternal,
      includeChildren: true,
    };

    // Parse symbol kind
    if (kind) {
      try {
        const parsedKinds = parseSymbolKind(kind);
        searchQuery.kind =
          parsedKinds && parsedKinds.length === 1
            ? parsedKinds[0]
            : parsedKinds;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return `Error: ${errorMessage}\n\nValid kinds: ${SYMBOL_KIND_NAMES.join(", ")}`;
      }
    }

    // Execute query
    const results = querySymbols(rootPath, searchQuery);

    if (results.length === 0) {
      return "No symbols found matching your search criteria.";
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

      // Add LSP tool guidance for this result
      output += `\n   Use these LSP tools for further operations:\n`;
      output += `   • View definition: lsp_get_definitions --root "${rootPath}" --relativePath "${relativePath}" --line ${line} --column ${column - 1}\n`;
      output += `   • Find references: lsp_find_references --root "${rootPath}" --relativePath "${relativePath}" --line ${line} --symbolName "${symbol.name}"\n`;
      output += `   • Get type info: lsp_get_hover --root "${rootPath}" --relativePath "${relativePath}" --line ${line} --character ${column - 1}\n`;
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
