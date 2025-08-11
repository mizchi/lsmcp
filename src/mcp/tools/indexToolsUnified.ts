/**
 * Unified symbol indexing tool for MCP
 */

import { z } from "zod";
import type { ToolDef } from "../utils/mcpHelpers.ts";
import { forceClearIndex, getOrCreateIndex } from "@lsmcp/code-indexer";
import { glob } from "gitaware-glob";
import { getLSPClient } from "@lsmcp/lsp-client";
import { loadIndexConfig } from "@lsmcp/code-indexer";
import { getAdapterDefaultPattern } from "@lsmcp/code-indexer";

// Unified index_symbols schema
const indexSymbolsSchema = z.object({
  pattern: z
    .string()
    .describe(
      "Glob pattern for files to index. If not specified, uses patterns from .lsmcp/config.json or adapter defaults",
    )
    .optional(),
  root: z.string().describe("Root directory for the project").optional(),
  concurrency: z
    .number()
    .min(1)
    .max(20)
    .describe(
      "Number of files to index in parallel. Defaults from config.json or adapter defaults",
    )
    .optional(),
  noCache: z
    .boolean()
    .default(false)
    .describe("Force full re-index, ignoring cache and incremental updates"),
  forceReset: z
    .boolean()
    .default(false)
    .describe("Completely reset the index before starting (clears all caches)"),
});

export const indexSymbolsTool: ToolDef<typeof indexSymbolsSchema> = {
  name: "index_symbols",
  description:
    "Smart symbol indexing that automatically detects and applies incremental updates. " +
    "On first run, indexes all files matching the pattern. " +
    "On subsequent runs, only updates modified files based on git changes. " +
    "Use noCache=true to force full re-indexing, or forceReset=true to completely clear and rebuild.",
  schema: indexSymbolsSchema,
  execute: async ({ pattern, root, concurrency, noCache, forceReset }) => {
    const rootPath = root || process.cwd();

    // Determine actual pattern and concurrency from config/defaults
    let actualPattern = pattern;
    let actualConcurrency = concurrency;

    // Try to load config.json first
    const config = loadIndexConfig(rootPath);

    if (!actualPattern) {
      if (config?.indexFiles && config.indexFiles.length > 0) {
        // Use patterns from config.json
        actualPattern = config.indexFiles.join(",");
        console.error(
          `[index_symbols] Using patterns from .lsmcp/config.json: ${actualPattern}`,
        );
      } else {
        // Try to detect adapter and use its defaults
        const client = getLSPClient();
        if (client) {
          // Get adapter ID from client initialization (would need to add this)
          // For now, fallback to TypeScript defaults
          actualPattern = getAdapterDefaultPattern("typescript");
          console.error(
            `[index_symbols] Using default TypeScript patterns: ${actualPattern}`,
          );
        } else {
          // Ultimate fallback
          actualPattern = "**/*.{ts,tsx,js,jsx}";
          console.error(
            `[index_symbols] Using fallback patterns: ${actualPattern}`,
          );
        }
      }
    }

    if (!actualConcurrency) {
      if (config?.settings?.indexConcurrency) {
        actualConcurrency = config.settings.indexConcurrency;
        console.error(
          `[index_symbols] Using concurrency from .lsmcp/config.json: ${actualConcurrency}`,
        );
      } else {
        actualConcurrency = 5; // Default
        console.error(
          `[index_symbols] Using default concurrency: ${actualConcurrency}`,
        );
      }
    }

    // Check if LSP client is initialized
    const client = getLSPClient();
    if (!client) {
      return `Error: LSP client not initialized. This usually means the MCP server was not started properly with a language server.`;
    }

    // Get or create index (this will create if not exists)
    let index = getOrCreateIndex(rootPath);
    if (!index) {
      return `Error: Failed to create symbol index. LSP client may not be properly initialized.`;
    }

    // Handle force reset
    if (forceReset) {
      console.error(`[index_symbols] Force resetting index for ${rootPath}`);
      await forceClearIndex(rootPath);
      // Re-create index after clearing
      index = getOrCreateIndex(rootPath);
      if (!index) {
        return `Error: Failed to recreate index after reset.`;
      }
    }

    // Get current stats to check if we have an existing index
    const statsBefore = index.getStats();
    const hasExistingIndex = statsBefore.totalFiles > 0;

    let output = "";
    let filesIndexed = 0;
    // let totalSymbols = 0;
    let duration = 0;
    let errors: Array<{ file: string; error: string }> = [];

    // Decide whether to do incremental or full indexing
    if (hasExistingIndex && !noCache) {
      // Try incremental update
      console.error(
        `[index_symbols] Performing incremental update for ${rootPath}`,
      );
      output += "Performing incremental update based on git changes...\n\n";

      const startTime = Date.now();
      try {
        const result = await index.updateIncremental();
        duration = Date.now() - startTime;

        if (result.updated.length > 0 || result.removed.length > 0) {
          output += `Incremental update completed in ${duration}ms:\n`;

          if (result.updated.length > 0) {
            output += `- Updated ${result.updated.length} files\n`;
            if (result.updated.length <= 10) {
              result.updated.forEach((file) => {
                output += `  • ${file}\n`;
              });
            } else {
              result.updated.slice(0, 5).forEach((file) => {
                output += `  • ${file}\n`;
              });
              output += `  ... and ${result.updated.length - 5} more\n`;
            }
          }

          if (result.removed.length > 0) {
            output += `- Removed ${result.removed.length} files\n`;
            if (result.removed.length <= 10) {
              result.removed.forEach((file) => {
                output += `  • ${file}\n`;
              });
            }
          }

          if (result.errors.length > 0) {
            output += `\nErrors encountered (${result.errors.length}):\n`;
            result.errors.slice(0, 5).forEach((err) => {
              output += `  • ${err}\n`;
            });
          }
        } else {
          output += "No changes detected since last index.\n";
        }

        filesIndexed = result.updated.length;
      } catch (error) {
        console.error(`[index_symbols] Incremental update failed:`, error);
        output += `Incremental update failed: ${error instanceof Error ? error.message : String(error)}\n`;
        output += "Falling back to full indexing...\n\n";
        // Fall back to full indexing
        noCache = true;
      }
    }

    // Perform full indexing if needed
    if (!hasExistingIndex || noCache) {
      console.error(
        `[index_symbols] Performing full index for ${rootPath} with pattern ${actualPattern}`,
      );
      output +=
        noCache && hasExistingIndex
          ? "Performing full re-index (cache disabled)...\n\n"
          : "Building initial symbol index...\n\n";

      // Find files matching pattern(s)
      const files: string[] = [];

      // Handle multiple patterns (comma-separated or from config array)
      const patterns = actualPattern.split(",").map((p) => p.trim());

      for (const singlePattern of patterns) {
        const filesIterator = await glob(singlePattern, {
          cwd: rootPath,
        });

        for await (const file of filesIterator) {
          // Avoid duplicates
          if (!files.includes(file)) {
            files.push(file);
          }
        }
      }

      if (files.length === 0) {
        return output + `No files found matching pattern: ${actualPattern}`;
      }

      console.error(`[index_symbols] Found ${files.length} files to index`);

      // Clear existing index if forcing no cache
      if (noCache && hasExistingIndex) {
        index.clear();
      }

      // Index files
      const startTime = Date.now();
      const errorHandler = (event: any) => {
        if (event.type === "indexError") {
          errors.push({
            file: event.uri,
            error: event.error.message,
          });
        }
      };

      index.on("indexError", errorHandler);

      try {
        await index.indexFiles(files, actualConcurrency);
        duration = Date.now() - startTime;
        filesIndexed = files.length;
      } finally {
        index.off("indexError", errorHandler);
      }

      output += `Indexed ${filesIndexed} files in ${duration}ms\n`;
    }

    // Get final stats
    const statsAfter = index.getStats();

    output += `\nIndex Statistics:\n`;
    output += `- Total files in index: ${statsAfter.totalFiles}\n`;
    output += `- Total symbols: ${statsAfter.totalSymbols}\n`;
    output += `- Average time per file: ${filesIndexed > 0 ? Math.round(duration / filesIndexed) : 0}ms\n`;

    if (errors.length > 0) {
      output += `\nErrors encountered (${errors.length}):\n`;
      errors.slice(0, 10).forEach((err) => {
        output += `  • ${err.file}: ${err.error}\n`;
      });
      if (errors.length > 10) {
        output += `  ... and ${errors.length - 10} more errors\n`;
      }
    }

    return output;
  },
};

// Export the unified tool
export const unifiedIndexTools = [indexSymbolsTool];
