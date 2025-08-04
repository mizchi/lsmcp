import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  searchCachedSymbolsFromIndexTool,
  getCacheStatsFromIndexTool,
  clearCacheFromIndexTool,
} from "./cacheTools.ts";
import * as cacheIntegration from "../cache/symbolCacheIntegration.ts";

vi.mock("../cache/symbolCacheIntegration.ts");

describe("cacheTools", () => {
  let mockCacheManager: any;

  beforeEach(() => {
    // Mock cache manager
    mockCacheManager = {
      getStats: vi.fn(),
      clearCache: vi.fn(),
    };

    vi.mocked(cacheIntegration.getSymbolCacheManager).mockReturnValue(
      mockCacheManager,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("searchCachedSymbols", () => {
    it("should search and return formatted symbols", async () => {
      const mockSymbols = [
        {
          filePath: "src/utils.ts",
          namePath: "formatDate",
          kind: 12, // Function
          containerName: undefined,
          startLine: 10,
          startCharacter: 0,
          endLine: 15,
          endCharacter: 1,
          lastModified: Date.now(),
          projectRoot: "/test",
        },
        {
          filePath: "src/helpers.ts",
          namePath: "formatNumber",
          kind: 12,
          containerName: undefined,
          startLine: 20,
          startCharacter: 0,
          endLine: 25,
          endCharacter: 1,
          lastModified: Date.now(),
          projectRoot: "/test",
        },
      ];

      vi.mocked(cacheIntegration.searchSymbolsInCache).mockReturnValue(
        mockSymbols,
      );

      const result = await searchCachedSymbolsFromIndexTool.execute({
        root: "/test",
        pattern: "format",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(2);
      expect(parsed.symbols).toHaveLength(2);

      expect(parsed.symbols[0]).toEqual({
        filePath: "src/utils.ts",
        namePath: "formatDate",
        kind: 12,
        location: {
          start: { line: 10, character: 0 },
          end: { line: 15, character: 1 },
        },
      });

      expect(cacheIntegration.searchSymbolsInCache).toHaveBeenCalledWith(
        "/test",
        "format",
      );
    });

    it("should handle empty results", async () => {
      vi.mocked(cacheIntegration.searchSymbolsInCache).mockReturnValue([]);

      const result = await searchCachedSymbolsFromIndexTool.execute({
        root: "/test",
        pattern: "nonexistent",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(0);
      expect(parsed.symbols).toEqual([]);
    });

    it("should handle errors", async () => {
      vi.mocked(cacheIntegration.searchSymbolsInCache).mockImplementation(
        () => {
          throw new Error("Database error");
        },
      );

      const result = await searchCachedSymbolsFromIndexTool.execute({
        root: "/test",
        pattern: "test",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Database error");
    });
  });

  describe("getCacheStats", () => {
    it("should return cache statistics", async () => {
      const mockStats = {
        totalSymbols: 150,
        totalFiles: 25,
      };

      mockCacheManager.getStats.mockReturnValue(mockStats);

      const result = await getCacheStatsFromIndexTool.execute({
        root: "/test",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.stats).toEqual(mockStats);
      expect(mockCacheManager.getStats).toHaveBeenCalledOnce();
    });

    it("should handle errors", async () => {
      mockCacheManager.getStats.mockImplementation(() => {
        throw new Error("Stats error");
      });

      const result = await getCacheStatsFromIndexTool.execute({
        root: "/test",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Stats error");
    });
  });

  describe("clearCache", () => {
    it("should clear cache successfully", async () => {
      mockCacheManager.clearCache.mockReturnValue(undefined);

      const result = await clearCacheFromIndexTool.execute({
        root: "/test",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.message).toBe("Symbol cache cleared successfully");
      expect(mockCacheManager.clearCache).toHaveBeenCalledOnce();
    });

    it("should handle errors", async () => {
      mockCacheManager.clearCache.mockImplementation(() => {
        throw new Error("Clear error");
      });

      const result = await clearCacheFromIndexTool.execute({
        root: "/test",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("Clear error");
    });
  });
});

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("cacheTools module", () => {
    it("exports all cache tools", () => {
      expect(searchCachedSymbolsFromIndexTool).toBeDefined();
      expect(getCacheStatsFromIndexTool).toBeDefined();
      expect(clearCacheFromIndexTool).toBeDefined();
    });

    it("tools have correct names", () => {
      expect(searchCachedSymbolsFromIndexTool.name).toBe(
        "search_cached_symbols_from_index",
      );
      expect(getCacheStatsFromIndexTool.name).toBe(
        "get_cache_stats_from_index",
      );
      expect(clearCacheFromIndexTool.name).toBe(
        "clear_symbol_cache_from_index",
      );
    });

    it("tools have appropriate descriptions", () => {
      expect(searchCachedSymbolsFromIndexTool.description).toContain("Search");
      expect(getCacheStatsFromIndexTool.description).toContain("statistics");
      expect(clearCacheFromIndexTool.description).toContain("Clear");
    });
  });
}
