/**
 * Unit tests for symbol index
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initializeSymbolIndex,
  indexFile,
  indexFiles,
  querySymbols,
  getFileSymbols,
  getSymbolAtPosition,
  getIndexStats,
  clearIndex,
  onIndexEvent,
  type SymbolIndexState,
} from "./symbolIndex.ts";
import { SymbolKind } from "vscode-languageserver-types";
import { EventEmitter } from "events";

// Mock LSP client
const mockGetDocumentSymbols = vi.fn();

vi.mock("@internal/lsp-client", () => {
  const fn = vi.fn();
  return {
    getLSPClient: () => ({
      getDocumentSymbols: mockGetDocumentSymbols,
    }),
    withTemporaryDocument: fn,
  };
});

// Mock cache integration
vi.mock("./cache/symbolCacheIntegration.ts", () => ({
  cacheSymbolsFromIndex: vi.fn(),
  loadCachedSymbols: vi.fn().mockReturnValue(null), // Always return null to force LSP lookup
  getSymbolCacheManager: vi.fn().mockReturnValue({
    invalidateFile: vi.fn(),
  }),
}));

// Mock fs module for file watching and promises
vi.mock("fs", () => ({
  watch: vi.fn().mockReturnValue({
    close: vi.fn(),
  }),
}));

vi.mock("fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue("test content"),
}));

// Setup withTemporaryDocument mock implementation after imports
import * as lspClientModule from "@internal/lsp-client";
const mockWithTemporaryDocument = vi.mocked(
  lspClientModule.withTemporaryDocument,
);
mockWithTemporaryDocument.mockImplementation(
  async (_client, _uri, _content, callback) => {
    // For tests, just call the callback
    return await (callback as any)();
  },
);

// Mock glob module
vi.mock("glob", () => ({
  glob: vi.fn().mockImplementation(() => {
    // Return test files for any pattern
    return Promise.resolve(["test1.ts", "test2.ts", "test3.ts"]);
  }),
}));

describe("SymbolIndex", () => {
  let state: SymbolIndexState;

  beforeEach(() => {
    // Reset mock before each test
    mockGetDocumentSymbols.mockReset();
    mockGetDocumentSymbols.mockResolvedValue([
      {
        name: "TestClass",
        kind: SymbolKind.Class,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 10, character: 0 },
        },
        selectionRange: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 15 },
        },
        children: [
          {
            name: "constructor",
            kind: SymbolKind.Constructor,
            range: {
              start: { line: 1, character: 2 },
              end: { line: 3, character: 3 },
            },
            selectionRange: {
              start: { line: 1, character: 2 },
              end: { line: 1, character: 13 },
            },
          },
          {
            name: "testMethod",
            kind: SymbolKind.Method,
            range: {
              start: { line: 5, character: 2 },
              end: { line: 7, character: 3 },
            },
            selectionRange: {
              start: { line: 5, character: 2 },
              end: { line: 5, character: 12 },
            },
          },
        ],
      },
      {
        name: "testFunction",
        kind: SymbolKind.Function,
        range: {
          start: { line: 12, character: 0 },
          end: { line: 14, character: 1 },
        },
        selectionRange: {
          start: { line: 12, character: 9 },
          end: { line: 12, character: 21 },
        },
      },
    ]);

    state = {
      rootPath: "/test/project",
      client: null,
      fileIndex: new Map(),
      symbolIndex: new Map(),
      kindIndex: new Map(),
      containerIndex: new Map(),
      fileWatchers: new Map(),
      stats: {
        totalFiles: 0,
        totalSymbols: 0,
        indexingTime: 0,
        lastUpdated: new Date(),
      },
      indexingQueue: new Set(),
      isIndexing: false,
      eventEmitter: new EventEmitter(),
    };
  });

  describe("initialize", () => {
    it("should initialize successfully", async () => {
      const mockClient = { getDocumentSymbols: mockGetDocumentSymbols };
      await expect(
        initializeSymbolIndex(state, mockClient),
      ).resolves.not.toThrow();
      expect(state.client).toBe(mockClient);
    });
  });

  describe("indexFile", () => {
    it("should index a file and update stats", async () => {
      const mockClient = { getDocumentSymbols: mockGetDocumentSymbols };
      await initializeSymbolIndex(state, mockClient);
      await indexFile(state, "test.ts");

      const stats = getIndexStats(state);
      expect(stats.totalFiles).toBe(1);
      expect(stats.totalSymbols).toBe(4); // TestClass + constructor + testMethod + testFunction (includes nested)
    });

    it("should emit fileIndexed event", async () => {
      const mockClient = { getDocumentSymbols: mockGetDocumentSymbols };
      await initializeSymbolIndex(state, mockClient);

      const fileIndexedHandler = vi.fn();
      onIndexEvent(state, "fileIndexed", fileIndexedHandler);

      await indexFile(state, "test.ts");

      expect(fileIndexedHandler).toHaveBeenCalledWith({
        uri: "file:///test/project/test.ts",
        symbolCount: 2, // Top-level symbols only (TestClass, testFunction)
        fromCache: false,
      });
    });
  });

  describe("query", () => {
    beforeEach(async () => {
      const mockClient = { getDocumentSymbols: mockGetDocumentSymbols };
      await initializeSymbolIndex(state, mockClient);
      await indexFile(state, "test.ts");
    });

    it("should find symbols by exact name", () => {
      const results = querySymbols(state, { name: "TestClass" });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("TestClass");
      expect(results[0].kind).toBe(SymbolKind.Class);
    });

    it("should find symbols by partial name match", () => {
      const results = querySymbols(state, { name: "test" });
      expect(results.length).toBeGreaterThanOrEqual(2);
      const names = results.map((s) => s.name.toLowerCase());
      expect(names).toContain("testclass");
      expect(names).toContain("testfunction");
    });

    it("should find symbols by kind", () => {
      const results = querySymbols(state, { kind: SymbolKind.Method });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("testMethod");
    });

    it("should find symbols by file", () => {
      const results = querySymbols(state, { file: "test.ts" });
      expect(results.length).toBeGreaterThan(0);
    });

    it("should combine multiple filters", () => {
      const results = querySymbols(state, {
        name: "test",
        kind: SymbolKind.Class,
      });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("TestClass");
    });

    it("should include child symbols when requested", () => {
      const results = querySymbols(state, {
        kind: SymbolKind.Class,
        includeChildren: true,
      });
      expect(results.length).toBeGreaterThan(1);
      const names = results.map((s) => s.name);
      expect(names).toContain("TestClass");
      expect(names).toContain("constructor");
      expect(names).toContain("testMethod");
    });
  });

  describe("getFileSymbols", () => {
    beforeEach(async () => {
      const mockClient = { getDocumentSymbols: mockGetDocumentSymbols };
      await initializeSymbolIndex(state, mockClient);
      await indexFile(state, "test.ts");
    });

    it("should return symbols for a file", () => {
      const symbols = getFileSymbols(state, "test.ts");
      expect(symbols).toHaveLength(2); // Top-level symbols only
      expect(symbols[0].name).toBe("TestClass");
      expect(symbols[1].name).toBe("testFunction");
    });

    it("should return empty array for non-indexed file", () => {
      const symbols = getFileSymbols(state, "notfound.ts");
      expect(symbols).toEqual([]);
    });
  });

  describe("getSymbolAtPosition", () => {
    beforeEach(async () => {
      const mockClient = { getDocumentSymbols: mockGetDocumentSymbols };
      await initializeSymbolIndex(state, mockClient);
      await indexFile(state, "test.ts");
    });

    it("should find symbol at position", () => {
      const symbol = getSymbolAtPosition(state, "test.ts", {
        line: 5,
        character: 5,
      });
      expect(symbol).toBeTruthy();
      expect(symbol!.name).toBe("testMethod");
    });

    it("should find parent symbol when position is in child", () => {
      const symbol = getSymbolAtPosition(state, "test.ts", {
        line: 2,
        character: 5,
      });
      expect(symbol).toBeTruthy();
      // Should find constructor (child) or TestClass (parent)
      expect(["constructor", "TestClass"]).toContain(symbol!.name);
    });

    it("should return null for position outside any symbol", () => {
      const symbol = getSymbolAtPosition(state, "test.ts", {
        line: 20,
        character: 0,
      });
      expect(symbol).toBeNull();
    });
  });

  describe("clear", () => {
    beforeEach(async () => {
      const mockClient = { getDocumentSymbols: mockGetDocumentSymbols };
      await initializeSymbolIndex(state, mockClient);
      await indexFile(state, "test.ts");
    });

    it("should clear all data and reset stats", () => {
      clearIndex(state);

      const stats = getIndexStats(state);
      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSymbols).toBe(0);
      expect(state.fileIndex.size).toBe(0);
      expect(state.symbolIndex.size).toBe(0);
    });

    it("should emit cleared event", () => {
      const clearedHandler = vi.fn();
      onIndexEvent(state, "cleared", clearedHandler);

      clearIndex(state);

      expect(clearedHandler).toHaveBeenCalled();
    });
  });

  describe("indexFiles", () => {
    it("should index multiple files in parallel", async () => {
      // Reset mock call count
      mockGetDocumentSymbols.mockClear();

      const mockClient = { getDocumentSymbols: mockGetDocumentSymbols };
      await initializeSymbolIndex(state, mockClient);

      const files = ["test1.ts", "test2.ts", "test3.ts"];
      await indexFiles(state, files, { concurrency: 2 });

      const stats = getIndexStats(state);
      expect(stats.totalFiles).toBe(3);
      expect(mockGetDocumentSymbols).toHaveBeenCalledTimes(3);
    });
  });
});
