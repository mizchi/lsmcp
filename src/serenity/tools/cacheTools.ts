import { z } from "zod";
import type { ToolDef } from "../../mcp/utils/mcpHelpers.ts";
import {
  searchSymbolsInCache,
  getSymbolCacheManager,
} from "../cache/symbolCacheIntegration.ts";

const searchCachedSymbolsSchema = z.object({
  root: z.string().describe("Root directory for the project"),
  pattern: z.string().describe("Search pattern for symbol names"),
});

export const searchCachedSymbolsTool: ToolDef<
  typeof searchCachedSymbolsSchema
> = {
  name: "search_cached_symbols",
  description: "Search for symbols in the SQLite cache",
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

export const getCacheStatsTool: ToolDef<typeof getCacheStatsSchema> = {
  name: "get_cache_stats",
  description: "Get statistics about the symbol cache",
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

export const clearCacheTool: ToolDef<typeof clearCacheSchema> = {
  name: "clear_symbol_cache",
  description: "Clear the SQLite symbol cache for the project",
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
