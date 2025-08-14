/**
 * Unified symbol indexing tool for MCP
 */

import { z } from "zod";
import { forceClearIndex, getOrCreateIndex } from "@internal/code-indexer";
import { glob } from "gitaware-glob";
import type { McpToolDef, McpContext } from "@internal/types";
import { loadIndexConfig } from "@internal/code-indexer";
import { getAdapterDefaultPattern } from "@internal/code-indexer";
import { debugLogWithPrefix } from "../../utils/debugLog.ts";

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

export const indexSymbolsTool: McpToolDef<typeof indexSymbolsSchema> = {
  name: "index_symbols",
  description:
    "Smart symbol indexing that automatically detects and applies incremental updates. " +
    "On first run, indexes all files matching the pattern. " +
    "On subsequent runs, only updates modified files based on git changes. " +
    "Use noCache=true to force full re-indexing, or forceReset=true to completely clear and rebuild.",
  schema: indexSymbolsSchema,
  execute: async (
    { pattern, root, concurrency, noCache, forceReset },
    context?: McpContext,
  ) => {
    const rootPath = root || process.cwd();

    // Determine actual pattern and concurrency from config/defaults
    let actualPattern = pattern;
    let actualConcurrency = concurrency;

    // Try to load config.json first
    const config = loadIndexConfig(rootPath);

    if (!actualPattern) {
      // Priority: 1. files from config, 2. files from context, 3. preset defaults, 4. error
      if (config?.files && config.files.length > 0) {
        // Use patterns from config.json
        actualPattern = config.files.join(",");
        debugLogWithPrefix(
          "index_symbols",
          `Using patterns from config.files: ${actualPattern}`,
        );
      } else if (
        context?.config?.files &&
        Array.isArray(context.config.files)
      ) {
        // Check if files are provided in context (from preset)
        actualPattern = (context.config.files as string[]).join(",");
        debugLogWithPrefix(
          "index_symbols",
          `Using patterns from context.config.files: ${actualPattern}`,
        );
      } else if (context?.config?.preset) {
        // Use preset-specific patterns
        const presetId = context.config.preset as string;
        actualPattern = getAdapterDefaultPattern(presetId);
        if (!actualPattern) {
          // Preset not found or has no default patterns
          debugLogWithPrefix(
            "index_symbols",
            `Unknown preset '${presetId}' or preset has no default patterns`,
          );
          return {
            success: false,
            message: `Unknown preset '${presetId}' or preset has no default patterns. Please specify 'files' in your .lsmcp/config.json`,
          };
        }
        debugLogWithPrefix(
          "index_symbols",
          `Using patterns from preset '${presetId}': ${actualPattern}`,
        );
      } else {
        // No preset or files configured
        debugLogWithPrefix(
          "index_symbols",
          "No file patterns configured. Please specify 'files' or 'preset' in config.",
        );
        return {
          success: false,
          message:
            "No file patterns configured. Please specify 'files' or 'preset' in your .lsmcp/config.json",
        };
      }
    }

    if (!actualConcurrency) {
      if (config?.settings?.indexConcurrency) {
        actualConcurrency = config.settings.indexConcurrency;
        debugLogWithPrefix(
          `[index_symbols] Using concurrency from .lsmcp/config.json: ${actualConcurrency}`,
        );
      } else {
        actualConcurrency = 5; // Default
        debugLogWithPrefix(
          `[index_symbols] Using default concurrency: ${actualConcurrency}`,
        );
      }
    }

    // Pass context to get LSP client

    // Get or create index (this will create if not exists)
    // Pass context which includes fs (FileSystemApi) and lspClient
    let index = getOrCreateIndex(rootPath, context);
    if (!index) {
      return `Error: Failed to create symbol index. LSP client may not be properly initialized.`;
    }

    // Handle force reset
    if (forceReset) {
      debugLogWithPrefix(
        "index_symbols",
        `Force resetting index for ${rootPath}`,
      );
      await forceClearIndex(rootPath);
      // Re-create index after clearing
      index = getOrCreateIndex(rootPath, context);
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
      debugLogWithPrefix(
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
        debugLogWithPrefix(
          "index_symbols",
          "Incremental update failed:",
          error,
        );
        output += `Incremental update failed: ${error instanceof Error ? error.message : String(error)}\n`;
        output += "Falling back to full indexing...\n\n";
        // Fall back to full indexing
        noCache = true;
      }
    }

    // Perform full indexing if needed
    if (!hasExistingIndex || noCache) {
      debugLogWithPrefix(
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

      debugLogWithPrefix(
        "index_symbols",
        `Found ${files.length} files to index`,
      );

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
