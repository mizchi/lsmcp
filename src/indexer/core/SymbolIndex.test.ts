/**
 * Tests for SymbolIndex
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SymbolIndex } from "./SymbolIndex.ts";
import { SymbolKind } from "vscode-languageserver-types";
import type {
  SymbolProvider,
  FileSystem,
  SymbolCache,
  IndexedSymbol,
} from "./types.ts";

describe("SymbolIndex", () => {
  let symbolIndex: SymbolIndex;
  let mockProvider: SymbolProvider;
  let mockFileSystem: FileSystem;
  let mockCache: SymbolCache;

  beforeEach(() => {
    mockProvider = {
      getDocumentSymbols: vi.fn(),
    };

    mockFileSystem = {
      readFile: vi.fn().mockResolvedValue("file content"),
      exists: vi.fn().mockResolvedValue(true),
      stat: vi.fn().mockResolvedValue({ mtime: new Date() }),
    };

    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    symbolIndex = new SymbolIndex(
      "/test/root",
      mockProvider,
      mockFileSystem,
      mockCache,
    );
  });

  describe("indexFile", () => {
    it("should index a file with symbols", async () => {
      const mockSymbols = [
        {
          name: "TestClass",
          kind: SymbolKind.Class,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 10, character: 0 },
          },
          children: [
            {
              name: "testMethod",
              kind: SymbolKind.Method,
              range: {
                start: { line: 2, character: 2 },
                end: { line: 4, character: 2 },
              },
            },
          ],
        },
      ];

      vi.mocked(mockProvider.getDocumentSymbols).mockResolvedValue(mockSymbols);

      const fileIndexedPromise = new Promise<any>((resolve) => {
        symbolIndex.once("fileIndexed", resolve);
      });

      await symbolIndex.indexFile("test.ts");

      const event = await fileIndexedPromise;
      expect(event.type).toBe("fileIndexed");
      expect(event.symbolCount).toBe(1); // Only top-level symbols (Class)
      expect(event.fromCache).toBe(false);

      // Verify stats
      const stats = symbolIndex.getStats();
      expect(stats.totalFiles).toBe(1);
      expect(stats.totalSymbols).toBe(1); // Only counts top-level symbols
    });

    it("should use cache when available", async () => {
      const cachedSymbols: IndexedSymbol[] = [
        {
          name: "CachedClass",
          kind: SymbolKind.Class,
          location: {
            uri: "file:///test/root/cached.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 5, character: 0 },
            },
          },
        },
      ];

      vi.mocked(mockCache.get).mockResolvedValue(cachedSymbols);

      const fileIndexedPromise = new Promise<any>((resolve) => {
        symbolIndex.once("fileIndexed", resolve);
      });

      await symbolIndex.indexFile("cached.ts");

      const event = await fileIndexedPromise;
      expect(event.fromCache).toBe(true);
      expect(mockProvider.getDocumentSymbols).not.toHaveBeenCalled();
    });

    it("should emit error on failure", async () => {
      const error = new Error("Failed to get symbols");
      vi.mocked(mockProvider.getDocumentSymbols).mockRejectedValue(error);

      const errorPromise = new Promise<any>((resolve) => {
        symbolIndex.once("indexError", resolve);
      });

      await symbolIndex.indexFile("error.ts");

      const event = await errorPromise;
      expect(event.type).toBe("indexError");
      expect(event.error.message).toBe("Failed to get symbols");
    });
  });

  describe("indexFiles", () => {
    it("should index multiple files with concurrency", async () => {
      const mockSymbols = [
        {
          name: "Symbol",
          kind: SymbolKind.Function,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 0 },
          },
        },
      ];

      vi.mocked(mockProvider.getDocumentSymbols).mockResolvedValue(mockSymbols);

      const events: any[] = [];
      symbolIndex.on("indexingStarted", (e) => events.push(e));
      symbolIndex.on("indexingCompleted", (e) => events.push(e));

      await symbolIndex.indexFiles(["file1.ts", "file2.ts", "file3.ts"], 2);

      expect(events[0].type).toBe("indexingStarted");
      expect(events[0].fileCount).toBe(3);
      expect(events[1].type).toBe("indexingCompleted");

      const stats = symbolIndex.getStats();
      expect(stats.totalFiles).toBe(3);
      expect(stats.totalSymbols).toBe(3);
    });
  });

  describe("querySymbols", () => {
    beforeEach(async () => {
      const mockSymbols = [
        {
          name: "TestClass",
          kind: SymbolKind.Class,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 20, character: 0 },
          },
          children: [
            {
              name: "constructor",
              kind: SymbolKind.Constructor,
              range: {
                start: { line: 2, character: 2 },
                end: { line: 4, character: 2 },
              },
            },
            {
              name: "testMethod",
              kind: SymbolKind.Method,
              range: {
                start: { line: 6, character: 2 },
                end: { line: 8, character: 2 },
              },
            },
          ],
        },
        {
          name: "testFunction",
          kind: SymbolKind.Function,
          range: {
            start: { line: 22, character: 0 },
            end: { line: 24, character: 0 },
          },
        },
        {
          name: "TestInterface",
          kind: SymbolKind.Interface,
          range: {
            start: { line: 26, character: 0 },
            end: { line: 28, character: 0 },
          },
        },
      ];

      vi.mocked(mockProvider.getDocumentSymbols).mockResolvedValue(mockSymbols);
      await symbolIndex.indexFile("test.ts");
    });

    it("should query by name", () => {
      const results = symbolIndex.querySymbols({
        name: "test",
        includeChildren: true,
      });
      // When includeChildren is true, we get: TestClass, testMethod, testFunction
      expect(results.length).toBe(3);
      const names = results.map((s) => s.name);
      expect(names).toContain("TestClass"); // contains "test"
      expect(names).toContain("testMethod");
      expect(names).toContain("testFunction");
    });

    it("should query by kind", () => {
      const results = symbolIndex.querySymbols({ kind: SymbolKind.Class });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("TestClass");
    });

    it("should query by multiple kinds", () => {
      const results = symbolIndex.querySymbols({
        kind: [SymbolKind.Class, SymbolKind.Interface],
      });
      expect(results.length).toBe(2);
      expect(results.map((s) => s.name)).toContain("TestClass");
      expect(results.map((s) => s.name)).toContain("TestInterface");
    });

    it("should query by container name", () => {
      // Query for symbols inside TestClass container
      const results = symbolIndex.querySymbols({
        containerName: "TestClass",
        includeChildren: true,
      });

      // Should find constructor and testMethod that are inside TestClass
      expect(results.length).toBe(2);
      const names = results.map((s) => s.name);
      expect(names).toContain("constructor");
      expect(names).toContain("testMethod");
    });

    it("should query with multiple filters", () => {
      const results = symbolIndex.querySymbols({
        name: "testFunction",
        kind: SymbolKind.Function,
      });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("testFunction");
    });

    it("should exclude children when requested", () => {
      const results = symbolIndex.querySymbols({
        kind: SymbolKind.Class,
        includeChildren: false,
      });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("TestClass");
    });
  });

  describe("removeFile", () => {
    it("should remove file from index", async () => {
      const mockSymbols = [
        {
          name: "ToRemove",
          kind: SymbolKind.Class,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 5, character: 0 },
          },
        },
      ];

      vi.mocked(mockProvider.getDocumentSymbols).mockResolvedValue(mockSymbols);
      await symbolIndex.indexFile("remove.ts");

      const removedPromise = new Promise<any>((resolve) => {
        symbolIndex.once("fileRemoved", resolve);
      });

      symbolIndex.removeFile("remove.ts");

      const event = await removedPromise;
      expect(event.type).toBe("fileRemoved");

      const stats = symbolIndex.getStats();
      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSymbols).toBe(0);

      // Verify symbol is not found
      const results = symbolIndex.querySymbols({ name: "ToRemove" });
      expect(results.length).toBe(0);
    });
  });

  describe("clear", () => {
    it("should clear all data", async () => {
      const mockSymbols = [
        {
          name: "Symbol",
          kind: SymbolKind.Function,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 0 },
          },
        },
      ];

      vi.mocked(mockProvider.getDocumentSymbols).mockResolvedValue(mockSymbols);
      await symbolIndex.indexFile("test.ts");

      symbolIndex.clear();

      const stats = symbolIndex.getStats();
      expect(stats.totalFiles).toBe(0);
      expect(stats.totalSymbols).toBe(0);

      const results = symbolIndex.querySymbols({});
      expect(results.length).toBe(0);
    });
  });
});
