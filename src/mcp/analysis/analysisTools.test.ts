/**
 * Unit tests for analysis tools
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  indexFilesTool,
  findSymbolTool,
  getFileSymbolsTool,
  getIndexStatsTool,
  clearIndexTool,
} from "./analysisTools.ts";
import { SymbolKind } from "vscode-languageserver-types";

// Mock glob
vi.mock("glob", () => ({
  glob: vi.fn().mockResolvedValue(["src/test1.ts", "src/test2.ts"]),
}));

// Mock symbol index state
const mockIndexState = {
  fileIndex: new Map(),
  symbolIndex: new Map(),
  kindIndex: new Map(),
  containerIndex: new Map(),
  fileWatchers: new Map(),
  indexingQueue: new Set(),
  isIndexing: false,
  rootPath: "/test/project",
  client: null,
  stats: {
    totalFiles: 2,
    totalSymbols: 10,
    indexingTime: 100,
    lastUpdated: new Date(),
  },
  eventEmitter: null,
};

vi.mock("./symbolIndex.ts", () => ({
  getSymbolIndex: vi.fn(() => mockIndexState),
  initializeSymbolIndex: vi.fn(),
  indexFiles: vi.fn(),
  querySymbols: vi.fn(),
  getFileSymbols: vi.fn(),
  getIndexStats: vi.fn(() => mockIndexState.stats),
  clearIndex: vi.fn(),
  clearSymbolIndex: vi.fn(),
}));

describe("Analysis Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock state
    mockIndexState.stats = {
      totalFiles: 2,
      totalSymbols: 10,
      indexingTime: 100,
      lastUpdated: new Date(),
    };
  });

  describe("indexFilesTool", () => {
    it("should index files matching pattern", async () => {
      const { getIndexStats, initializeSymbolIndex, indexFiles } = await import(
        "./symbolIndex.ts"
      );

      vi.mocked(getIndexStats).mockReturnValueOnce({
        totalFiles: 0,
        totalSymbols: 0,
        indexingTime: 0,
        lastUpdated: new Date(),
      }); // First call
      vi.mocked(getIndexStats).mockReturnValueOnce({
        // Second call after indexing
        totalFiles: 2,
        totalSymbols: 10,
        indexingTime: 100,
        lastUpdated: new Date(),
      });

      const result = await indexFilesTool.execute({
        pattern: "src/**/*.ts",
        root: "/test/project",
        concurrency: 5,
      });

      expect(initializeSymbolIndex).toHaveBeenCalled();
      expect(indexFiles).toHaveBeenCalledWith(
        mockIndexState,
        ["src/test1.ts", "src/test2.ts"],
        5,
      );
      expect(result).toContain("Indexed 2 files");
      expect(result).toContain("Total files in index: 2");
      expect(result).toContain("Total symbols: 10");
    });

    it("should handle no files found", async () => {
      const { glob } = await import("glob");
      vi.mocked(glob).mockResolvedValueOnce([]);

      const result = await indexFilesTool.execute({
        pattern: "nonexistent/**/*.ts",
        root: "/test/project",
        concurrency: 5,
      });

      expect(result).toBe(
        "No files found matching pattern: nonexistent/**/*.ts",
      );
    });
  });

  describe("findSymbolTool", () => {
    it("should find symbols by name", async () => {
      const { querySymbols } = await import("./symbolIndex.ts");

      vi.mocked(querySymbols).mockReturnValue([
        {
          name: "TestClass",
          kind: SymbolKind.Class,
          location: {
            uri: "file:///test/project/src/test.ts",
            range: {
              start: { line: 5, character: 0 },
              end: { line: 10, character: 0 },
            },
          },
        },
      ]);

      const result = await findSymbolTool.execute({
        name: "TestClass",
        root: "/test/project",
        includeChildren: true,
      });

      expect(querySymbols).toHaveBeenCalledWith(mockIndexState, {
        name: "TestClass",
        includeChildren: true,
      });
      expect(result).toContain("Found 1 symbol(s)");
      expect(result).toContain("TestClass [Class]");
      expect(result).toContain("src/test.ts:6:1");
    });

    it("should find symbols by kind", async () => {
      const { querySymbols } = await import("./symbolIndex.ts");

      vi.mocked(querySymbols).mockReturnValue([
        {
          name: "testFunction",
          kind: SymbolKind.Function,
          location: {
            uri: "file:///test/project/src/utils.ts",
            range: {
              start: { line: 2, character: 0 },
              end: { line: 5, character: 0 },
            },
          },
        },
      ]);

      const result = await findSymbolTool.execute({
        kind: "Function",
        root: "/test/project",
        includeChildren: true,
      });

      expect(querySymbols).toHaveBeenCalledWith(mockIndexState, {
        kind: SymbolKind.Function,
        includeChildren: true,
      });
      expect(result).toContain("Found 1 symbol(s)");
      expect(result).toContain("testFunction [Function]");
    });

    it("should handle no symbols found", async () => {
      const { querySymbols } = await import("./symbolIndex.ts");
      vi.mocked(querySymbols).mockReturnValue([]);

      const result = await findSymbolTool.execute({
        name: "NonExistent",
        root: "/test/project",
        includeChildren: true,
      });

      expect(result).toBe("No symbols found matching the query.");
    });

    it("should remind to index when no files indexed", async () => {
      const { getIndexStats } = await import("./symbolIndex.ts");
      vi.mocked(getIndexStats).mockReturnValue({
        totalFiles: 0,
        totalSymbols: 0,
        indexingTime: 0,
        lastUpdated: new Date(),
      });

      const result = await findSymbolTool.execute({
        name: "TestClass",
        root: "/test/project",
        includeChildren: true,
      });

      expect(result).toBe("No files indexed. Please run index_files first.");
    });
  });

  describe("getFileSymbolsTool", () => {
    it("should get symbols for a file", async () => {
      const { getFileSymbols } = await import("./symbolIndex.ts");

      vi.mocked(getFileSymbols).mockReturnValue([
        {
          name: "TestClass",
          kind: SymbolKind.Class,
          location: {
            uri: "file:///test/project/src/test.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 10, character: 0 },
            },
          },
          children: [
            {
              name: "constructor",
              kind: SymbolKind.Constructor,
              location: {
                uri: "file:///test/project/src/test.ts",
                range: {
                  start: { line: 1, character: 2 },
                  end: { line: 3, character: 3 },
                },
              },
            },
          ],
        },
      ]);

      const result = await getFileSymbolsTool.execute({
        filePath: "src/test.ts",
        root: "/test/project",
      });

      expect(getFileSymbols).toHaveBeenCalledWith(
        mockIndexState,
        "src/test.ts",
      );
      expect(result).toContain("Symbols in src/test.ts:");
      expect(result).toContain("TestClass [Class] (1:1)");
      expect(result).toContain("  constructor [Constructor] (2:3)");
    });

    it("should handle file not indexed", async () => {
      const { getFileSymbols } = await import("./symbolIndex.ts");
      vi.mocked(getFileSymbols).mockReturnValue([]);

      const result = await getFileSymbolsTool.execute({
        filePath: "src/notindexed.ts",
        root: "/test/project",
      });

      expect(result).toBe(
        "No symbols found in file: src/notindexed.ts. The file may not be indexed yet.",
      );
    });
  });

  describe("getIndexStatsTool", () => {
    it("should return index statistics", async () => {
      const { getIndexStats } = await import("./symbolIndex.ts");

      // Ensure the mock returns the expected stats
      vi.mocked(getIndexStats).mockReturnValue({
        totalFiles: 2,
        totalSymbols: 10,
        indexingTime: 100,
        lastUpdated: new Date(),
      });

      const result = await getIndexStatsTool.execute({
        root: "/test/project",
      });

      expect(result).toContain("Symbol Index Statistics:");
      expect(result).toContain("Total files indexed: 2");
      expect(result).toContain("Total symbols: 10");
      expect(result).toContain("Total indexing time: 100ms");
      expect(result).toContain("Average time per file: 50ms");
    });
  });

  describe("clearIndexTool", () => {
    it("should clear the index", async () => {
      const { clearIndex, getIndexStats } = await import("./symbolIndex.ts");

      vi.mocked(getIndexStats).mockReturnValue({
        totalFiles: 5,
        totalSymbols: 25,
        indexingTime: 500,
        lastUpdated: new Date(),
      });

      const result = await clearIndexTool.execute({
        root: "/test/project",
      });

      expect(clearIndex).toHaveBeenCalledWith(mockIndexState);
      expect(result).toContain("Cleared symbol index:");
      expect(result).toContain("Removed 5 files");
      expect(result).toContain("Removed 25 symbols");
      expect(result).toContain("Stopped all file watchers");
    });
  });
});
