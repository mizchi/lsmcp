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

// Mock LSP client
vi.mock("../../lsp/lspClient.ts", () => ({
  getLSPClient: () => ({
    getDocumentSymbols: vi.fn().mockResolvedValue([
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
          end: { line: 15, character: 0 },
        },
        selectionRange: {
          start: { line: 12, character: 9 },
          end: { line: 12, character: 21 },
        },
      },
    ]),
  }),
}));

describe("SymbolIndex", () => {
  let state: SymbolIndexState;

  beforeEach(async () => {
    const { EventEmitter } = await import("events");
    state = {
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
        totalFiles: 0,
        totalSymbols: 0,
        indexingTime: 0,
        lastUpdated: new Date(),
      },
      eventEmitter: new EventEmitter(),
    };
  });

  describe("initialize", () => {
    it("should initialize successfully", async () => {
      await expect(initializeSymbolIndex(state)).resolves.not.toThrow();
    });
  });

  describe("indexFile", () => {
    it("should index a file and update stats", async () => {
      await initializeSymbolIndex(state);
      await indexFile(state, "test.ts");

      const stats = getIndexStats(state);
      expect(stats.totalFiles).toBe(1);
      expect(stats.totalSymbols).toBe(4); // TestClass + constructor + testMethod + testFunction
    });

    it("should emit fileIndexed event", async () => {
      await initializeSymbolIndex(state);

      const fileIndexedHandler = vi.fn();
      onIndexEvent(state, "fileIndexed", fileIndexedHandler);

      await indexFile(state, "test.ts");

      expect(fileIndexedHandler).toHaveBeenCalledWith({
        uri: expect.stringContaining("file:///test/project/test.ts"),
        symbolCount: 2, // Top-level symbols only
      });
    });
  });

  describe("query", () => {
    beforeEach(async () => {
      await initializeSymbolIndex(state);
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
      expect(results.some((s) => s.name === "testFunction")).toBe(true);
      expect(results.some((s) => s.name === "testMethod")).toBe(true);
    });

    it("should find symbols by kind", () => {
      const results = querySymbols(state, { kind: SymbolKind.Method });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("testMethod");
    });

    it("should find symbols by multiple kinds", () => {
      const results = querySymbols(state, {
        kind: [SymbolKind.Class, SymbolKind.Function],
      });
      expect(results).toHaveLength(2);
      expect(results.some((s) => s.name === "TestClass")).toBe(true);
      expect(results.some((s) => s.name === "testFunction")).toBe(true);
    });

    it("should return all symbols when no filters provided", () => {
      const results = querySymbols(state, {});
      expect(results.length).toBeGreaterThanOrEqual(4); // Including children
    });

    it("should exclude children when includeChildren is false", () => {
      const results = querySymbols(state, { includeChildren: false });
      expect(results).toHaveLength(2); // Only top-level symbols
    });
  });

  describe("getFileSymbols", () => {
    it("should return symbols for indexed file", async () => {
      await initializeSymbolIndex(state);
      await indexFile(state, "test.ts");

      const symbols = getFileSymbols(state, "test.ts");
      expect(symbols).toHaveLength(2);
      expect(symbols[0].name).toBe("TestClass");
      expect(symbols[1].name).toBe("testFunction");
    });

    it("should return empty array for non-indexed file", async () => {
      await initializeSymbolIndex(state);

      const symbols = getFileSymbols(state, "nonexistent.ts");
      expect(symbols).toEqual([]);
    });
  });

  describe("getSymbolAtPosition", () => {
    beforeEach(async () => {
      await initializeSymbolIndex(state);
      await indexFile(state, "test.ts");
    });

    it("should find symbol at position", () => {
      const symbol = getSymbolAtPosition(state, "test.ts", {
        line: 6,
        character: 5,
      });
      expect(symbol).not.toBeNull();
      expect(symbol!.name).toBe("testMethod");
    });

    it("should find parent symbol when position is in child", () => {
      const symbol = getSymbolAtPosition(state, "test.ts", {
        line: 2,
        character: 5,
      });
      expect(symbol).not.toBeNull();
      expect(symbol!.name).toBe("constructor");
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
    it("should clear all data and reset stats", async () => {
      await initializeSymbolIndex(state);
      await indexFile(state, "test.ts");

      clearIndex(state);

      const stats = getIndexStats(state);
      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSymbols).toBe(0);

      const symbols = getFileSymbols(state, "test.ts");
      expect(symbols).toEqual([]);
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
      await initializeSymbolIndex(state);

      const files = ["file1.ts", "file2.ts", "file3.ts"];
      await indexFiles(state, files, 2);

      const stats = getIndexStats(state);
      expect(stats.totalFiles).toBe(3);
    });
  });
});
