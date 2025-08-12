import { z } from "zod";
import type { ToolDef } from "../../utils/mcpHelpers.ts";
import {
  searchSymbolsInCache,
  getSymbolCacheManager,
} from "@lsmcp/code-indexer";

const searchCachedSymbolsSchema = z.object({
  root: z.string().describe("Root directory for the project"),
  pattern: z.string().describe("Search pattern for symbol names"),
});

export const searchCachedSymbolsFromIndexTool: ToolDef<
  typeof searchCachedSymbolsSchema
> = {
  name: "search_cached_symbols_from_index",
  description:
    "Search for symbols in the SQLite cache. This is an internal cache used by the index system for persistence. " +
    "For normal symbol searches, use 'search_symbol_from_index' instead.",
  schema: searchCachedSymbolsSchema,
  execute: async ({ root, pattern }) => {
    try {
      const symbols = searchSymbolsInCache(root, pattern);

      const results = symbols.map((sym) => ({
        filePath: sym.filePath,
        namePath: sym.namePath,
        kind: sym.kind,
        location: {
          start: { line: sym.startLine, character: sym.startCharacter },
          end: { line: sym.endLine, character: sym.endCharacter },
        },
      }));

      return JSON.stringify({
        success: true,
        count: results.length,
        symbols: results,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

const getCacheStatsSchema = z.object({
  root: z.string().describe("Root directory for the project"),
});

export const getCacheStatsFromIndexTool: ToolDef<typeof getCacheStatsSchema> = {
  name: "get_cache_stats_from_index",
  description:
    "Get statistics about the symbol cache. This shows information about the internal SQLite cache used for persistence.",
  schema: getCacheStatsSchema,
  execute: async ({ root }) => {
    try {
      const manager = getSymbolCacheManager(root);
      const stats = manager.getStats();

      return JSON.stringify({
        success: true,
        stats,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

const clearCacheSchema = z.object({
  root: z.string().describe("Root directory for the project"),
});

export const clearCacheFromIndexTool: ToolDef<typeof clearCacheSchema> = {
  name: "clear_symbol_cache_from_index",
  description:
    "Clear the SQLite symbol cache for the project. This is usually handled automatically. " +
    "Use 'clear_index' with force=true for complete index reset.",
  schema: clearCacheSchema,
  execute: async ({ root }) => {
    try {
      const manager = getSymbolCacheManager(root);
      manager.clearCache();

      return JSON.stringify({
        success: true,
        message: "Symbol cache cleared successfully",
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
