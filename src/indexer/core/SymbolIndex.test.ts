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
import * as gitUtils from "../utils/gitUtils.ts";

// Mock git utilities
vi.mock("../utils/gitUtils.ts", () => ({
  getGitHashAsync: vi.fn().mockResolvedValue({
    isOk: () => true,
    isErr: () => false,
    value: "test-hash-123",
    _unsafeUnwrap: () => "test-hash-123",
  }),
  getModifiedFilesAsync: vi.fn().mockResolvedValue({
    isOk: () => true,
    isErr: () => false,
    value: [],
    _unsafeUnwrap: () => [],
  }),
  getUntrackedFilesAsync: vi.fn().mockResolvedValue({
    isOk: () => true,
    isErr: () => false,
    value: [],
    _unsafeUnwrap: () => [],
  }),
  getFileGitHash: vi.fn().mockResolvedValue({
    isOk: () => true,
    isErr: () => false,
    value: "file-hash-123",
    _unsafeUnwrap: () => "file-hash-123",
  }),
}));

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
          selectionRange: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 15 },
          },
          children: [
            {
              name: "testMethod",
              kind: SymbolKind.Method,
              range: {
                start: { line: 2, character: 2 },
                end: { line: 4, character: 2 },
              },
              selectionRange: {
                start: { line: 2, character: 2 },
                end: { line: 2, character: 12 },
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
      expect(stats.totalSymbols).toBe(2); // TestClass + testMethod (counts all symbols)
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

      await symbolIndex.indexFiles(["file1.ts", "file2.ts", "file3.ts"], 2, {});

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
          selectionRange: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 15 },
          },
          children: [
            {
              name: "constructor",
              kind: SymbolKind.Constructor,
              range: {
                start: { line: 2, character: 2 },
                end: { line: 4, character: 2 },
              },
              selectionRange: {
                start: { line: 2, character: 2 },
                end: { line: 2, character: 13 },
              },
            },
            {
              name: "testMethod",
              kind: SymbolKind.Method,
              range: {
                start: { line: 6, character: 2 },
                end: { line: 8, character: 2 },
              },
              selectionRange: {
                start: { line: 6, character: 2 },
                end: { line: 6, character: 12 },
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
          selectionRange: {
            start: { line: 22, character: 9 },
            end: { line: 22, character: 21 },
          },
        },
        {
          name: "TestInterface",
          kind: SymbolKind.Interface,
          range: {
            start: { line: 26, character: 0 },
            end: { line: 28, character: 0 },
          },
          selectionRange: {
            start: { line: 26, character: 10 },
            end: { line: 26, character: 23 },
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

      // When includeChildren is true, we get: TestClass, testMethod, testFunction, TestInterface
      expect(results.length).toBe(4);
      const names = results.map((s) => s.name);
      expect(names).toContain("TestClass"); // contains "test"
      expect(names).toContain("testMethod");
      expect(names).toContain("testFunction");
      expect(names).toContain("TestInterface"); // also contains "test"
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

  describe("updateIncremental", () => {
    it("should handle empty repository (no git hash)", async () => {
      vi.mocked(gitUtils.getGitHashAsync).mockResolvedValueOnce({
        isOk: () => false,
        isErr: () => true,
        error: { type: "NOT_GIT_REPO", message: "Not a git repository" },
        _unsafeUnwrapErr: () => ({
          type: "NOT_GIT_REPO",
          message: "Not a git repository",
        }),
      } as any);

      const result = await symbolIndex.updateIncremental();

      expect(result.errors).toContain("Not a git repository");
      expect(result.updated).toEqual([]);
      expect(result.removed).toEqual([]);
    });

    it("should handle first time indexing (no previous hash)", async () => {
      vi.mocked(gitUtils.getGitHashAsync).mockResolvedValueOnce({
        isOk: () => true,
        isErr: () => false,
        value: "new-hash",
        _unsafeUnwrap: () => "new-hash",
      } as any);

      const result = await symbolIndex.updateIncremental();

      expect(result.errors).toContain("No previous git hash found");
      expect(result.updated).toEqual([]);
      expect(result.removed).toEqual([]);
    });

    it("should handle large number of modified files without crashing", async () => {
      // Simulate initial indexing
      const mockSymbols = [
        {
          name: "TestSymbol",
          kind: SymbolKind.Function,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 0 },
          },
          selectionRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 10 },
          },
        },
      ];
      vi.mocked(mockProvider.getDocumentSymbols).mockResolvedValue(mockSymbols);
      await symbolIndex.indexFiles(["test1.ts"]);

      // Simulate many modified files
      const modifiedFiles = Array.from({ length: 50 }, (_, i) => `file${i}.ts`);
      vi.mocked(gitUtils.getGitHashAsync).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: "new-hash",
        _unsafeUnwrap: () => "new-hash",
      } as any);
      vi.mocked(gitUtils.getModifiedFilesAsync).mockResolvedValueOnce({
        isOk: () => true,
        isErr: () => false,
        value: modifiedFiles,
        _unsafeUnwrap: () => modifiedFiles,
      } as any);
      vi.mocked(gitUtils.getUntrackedFilesAsync).mockResolvedValueOnce({
        isOk: () => true,
        isErr: () => false,
        value: [],
        _unsafeUnwrap: () => [],
      } as any);

      // This should not crash
      const result = await symbolIndex.updateIncremental();

      expect(result.updated.length).toBe(50);
      expect(result.errors).toEqual([]);
    });

    it("should handle mixed file updates and deletions", async () => {
      // Initial index
      const mockSymbols = [
        {
          name: "TestSymbol",
          kind: SymbolKind.Function,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 0 },
          },
        },
      ];
      vi.mocked(mockProvider.getDocumentSymbols).mockResolvedValue(mockSymbols);
      await symbolIndex.indexFiles(["existing.ts", "deleted.ts"]);

      vi.mocked(gitUtils.getGitHashAsync).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: "new-hash",
        _unsafeUnwrap: () => "new-hash",
      } as any);
      vi.mocked(gitUtils.getModifiedFilesAsync).mockResolvedValueOnce({
        isOk: () => true,
        isErr: () => false,
        value: ["existing.ts", "deleted.ts", "new.ts"],
        _unsafeUnwrap: () => ["existing.ts", "deleted.ts", "new.ts"],
      } as any);
      vi.mocked(gitUtils.getUntrackedFilesAsync).mockResolvedValueOnce({
        isOk: () => true,
        isErr: () => false,
        value: [],
        _unsafeUnwrap: () => [],
      } as any);

      // Mock file existence
      vi.mocked(mockFileSystem.exists)
        .mockResolvedValueOnce(true) // existing.ts
        .mockResolvedValueOnce(false) // deleted.ts
        .mockResolvedValueOnce(true); // new.ts

      const result = await symbolIndex.updateIncremental();

      expect(result.updated).toContain("existing.ts");
      expect(result.updated).toContain("new.ts");
      expect(result.removed).toContain("deleted.ts");
    });

    it.skip("should handle errors during file indexing", async () => {
      const mockSymbols = [
        {
          name: "TestSymbol",
          kind: SymbolKind.Function,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 0 },
          },
        },
      ];
      vi.mocked(mockProvider.getDocumentSymbols).mockResolvedValue(mockSymbols);
      await symbolIndex.indexFiles(["test.ts"]);

      vi.mocked(gitUtils.getGitHashAsync).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: "new-hash",
        _unsafeUnwrap: () => "new-hash",
      } as any);
      vi.mocked(gitUtils.getModifiedFilesAsync).mockResolvedValueOnce({
        isOk: () => true,
        isErr: () => false,
        value: ["error.ts"],
        _unsafeUnwrap: () => ["error.ts"],
      } as any);
      vi.mocked(gitUtils.getUntrackedFilesAsync).mockResolvedValueOnce({
        isOk: () => true,
        isErr: () => false,
        value: [],
        _unsafeUnwrap: () => [],
      } as any);

      // Mock error during file read
      vi.mocked(mockFileSystem.exists).mockResolvedValueOnce(true);
      vi.mocked(mockFileSystem.readFile).mockRejectedValueOnce(
        new Error("Read error"),
      );

      const result = await symbolIndex.updateIncremental();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("error.ts");
      expect(result.errors[0]).toContain("Read error");
    });

    it("should filter untracked files to only include supported extensions", async () => {
      const mockSymbols = [
        {
          name: "TestSymbol",
          kind: SymbolKind.Function,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 0 },
          },
        },
      ];
      vi.mocked(mockProvider.getDocumentSymbols).mockResolvedValue(mockSymbols);
      await symbolIndex.indexFiles(["test.ts"]);

      vi.mocked(gitUtils.getGitHashAsync).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: "new-hash",
        _unsafeUnwrap: () => "new-hash",
      } as any);
      vi.mocked(gitUtils.getModifiedFilesAsync).mockResolvedValueOnce({
        isOk: () => true,
        isErr: () => false,
        value: [],
        _unsafeUnwrap: () => [],
      } as any);
      vi.mocked(gitUtils.getUntrackedFilesAsync).mockResolvedValueOnce({
        isOk: () => true,
        isErr: () => false,
        value: [
          "test.ts",
          "test.tsx",
          "test.js",
          "test.jsx",
          "test.py", // Should be filtered out
          "README.md", // Should be filtered out
          "config.json", // Should be filtered out
        ],
        _unsafeUnwrap: () => [
          "test.ts",
          "test.tsx",
          "test.js",
          "test.jsx",
          "test.py",
          "README.md",
          "config.json",
        ],
      } as any);

      const result = await symbolIndex.updateIncremental();

      expect(result.updated).toHaveLength(4);
      expect(result.updated).toContain("test.ts");
      expect(result.updated).toContain("test.tsx");
      expect(result.updated).toContain("test.js");
      expect(result.updated).toContain("test.jsx");
      expect(result.updated).not.toContain("test.py");
      expect(result.updated).not.toContain("README.md");
      expect(result.updated).not.toContain("config.json");
    });

    it("should update git hash after successful incremental update", async () => {
      const mockSymbols = [
        {
          name: "TestSymbol",
          kind: SymbolKind.Function,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 0 },
          },
        },
      ];
      vi.mocked(mockProvider.getDocumentSymbols).mockResolvedValue(mockSymbols);
      await symbolIndex.indexFiles(["test.ts"]);
      const initialStats = symbolIndex.getStats();

      vi.mocked(gitUtils.getGitHashAsync).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: "new-hash-456",
        _unsafeUnwrap: () => "new-hash-456",
      } as any);
      vi.mocked(gitUtils.getModifiedFilesAsync).mockResolvedValueOnce({
        isOk: () => true,
        isErr: () => false,
        value: ["test.ts"],
        _unsafeUnwrap: () => ["test.ts"],
      } as any);
      vi.mocked(gitUtils.getUntrackedFilesAsync).mockResolvedValueOnce({
        isOk: () => true,
        isErr: () => false,
        value: [],
        _unsafeUnwrap: () => [],
      } as any);

      await symbolIndex.updateIncremental();

      const updatedStats = symbolIndex.getStats();
      expect(updatedStats.lastGitHash).toBe("new-hash-456");
      expect(updatedStats.lastUpdated.getTime()).toBeGreaterThan(
        initialStats.lastUpdated.getTime(),
      );
    });
  });

  describe("needsReindex", () => {
    it("should return true for non-indexed files", async () => {
      const result = await symbolIndex.needsReindex("new-file.ts");
      expect(result).toBe(true);
    });

    it("should use git hash comparison when available", async () => {
      const mockSymbols = [
        {
          name: "TestSymbol",
          kind: SymbolKind.Function,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 0 },
          },
          selectionRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 10 },
          },
        },
      ];
      vi.mocked(mockProvider.getDocumentSymbols).mockResolvedValue(mockSymbols);
      await symbolIndex.indexFile("test.ts");

      // Same git hash - no reindex needed
      vi.mocked(gitUtils.getFileGitHash).mockResolvedValueOnce({
        isOk: () => true,
        isErr: () => false,
        value: "file-hash-123",
        _unsafeUnwrap: () => "file-hash-123",
      } as any);
      expect(await symbolIndex.needsReindex("test.ts")).toBe(false);

      // Different git hash - reindex needed
      vi.mocked(gitUtils.getFileGitHash).mockResolvedValueOnce({
        isOk: () => true,
        isErr: () => false,
        value: "file-hash-456",
        _unsafeUnwrap: () => "file-hash-456",
      } as any);
      expect(await symbolIndex.needsReindex("test.ts")).toBe(true);
    });

    it.skip("should fallback to mtime when git hash unavailable", async () => {
      const mockSymbols = [
        {
          name: "TestSymbol",
          kind: SymbolKind.Function,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 0 },
          },
          selectionRange: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 10 },
          },
        },
      ];
      vi.mocked(mockProvider.getDocumentSymbols).mockResolvedValue(mockSymbols);
      await symbolIndex.indexFile("test.ts");
      vi.mocked(gitUtils.getFileGitHash).mockResolvedValueOnce({
        isOk: () => false,
        isErr: () => true,
        error: { type: "GIT_ERROR", message: "Failed to get file hash" },
        _unsafeUnwrapErr: () => ({
          type: "GIT_ERROR",
          message: "Failed to get file hash",
        }),
      } as any);

      // File not modified - no reindex
      vi.mocked(mockFileSystem.stat).mockResolvedValueOnce({
        mtime: new Date(Date.now() - 10000), // 10 seconds ago
      });
      expect(await symbolIndex.needsReindex("test.ts")).toBe(false);

      // File modified - needs reindex
      vi.mocked(mockFileSystem.stat).mockResolvedValueOnce({
        mtime: new Date(Date.now() + 10000), // 10 seconds in future
      });
      expect(await symbolIndex.needsReindex("test.ts")).toBe(true);
    });
  });

  describe("Memory efficiency", () => {
    it("should handle concurrent file indexing without memory issues", async () => {
      const mockSymbols = [
        {
          name: "TestSymbol",
          kind: SymbolKind.Function,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 0 },
          },
        },
      ];
      vi.mocked(mockProvider.getDocumentSymbols).mockResolvedValue(mockSymbols);

      const files = Array.from({ length: 100 }, (_, i) => `file${i}.ts`);

      // This should not cause memory issues
      await symbolIndex.indexFiles(files, 10, { skipFailures: true }); // 10 concurrent

      const stats = symbolIndex.getStats();
      expect(stats.totalFiles).toBe(100);
    });

    it("should report progress during batch processing", async () => {
      const mockSymbols = [
        {
          name: "TestSymbol",
          kind: SymbolKind.Function,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 0 },
          },
        },
      ];
      vi.mocked(mockProvider.getDocumentSymbols).mockResolvedValue(mockSymbols);

      const files = Array.from({ length: 20 }, (_, i) => `file${i}.ts`);
      const progressReports: Array<{ current: number; total: number }> = [];

      await symbolIndex.indexFiles(files, 5, {
        onProgress: (progress) => progressReports.push(progress),
      });

      // Should have progress reports
      expect(progressReports.length).toBeGreaterThan(0);
      expect(progressReports[progressReports.length - 1].current).toBe(20);
      expect(progressReports[progressReports.length - 1].total).toBe(20);
    });

    it("should handle batch processing in updateIncremental", async () => {
      // Initial index
      const mockSymbols = [
        {
          name: "TestSymbol",
          kind: SymbolKind.Function,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 1, character: 0 },
          },
        },
      ];
      vi.mocked(mockProvider.getDocumentSymbols).mockResolvedValue(mockSymbols);
      await symbolIndex.indexFiles(["test.ts"]);

      // Simulate many modified files
      const modifiedFiles = Array.from({ length: 30 }, (_, i) => `file${i}.ts`);
      vi.mocked(gitUtils.getGitHashAsync).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: "new-hash",
        _unsafeUnwrap: () => "new-hash",
      } as any);
      vi.mocked(gitUtils.getModifiedFilesAsync).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: modifiedFiles,
        _unsafeUnwrap: () => modifiedFiles,
      } as any);
      vi.mocked(gitUtils.getUntrackedFilesAsync).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: [],
        _unsafeUnwrap: () => [],
      } as any);

      const progressReports: Array<{ current: number; total: number }> = [];

      const result = await symbolIndex.updateIncremental({
        batchSize: 5,
        onProgress: (progress) => progressReports.push(progress),
      });

      expect(result.updated.length).toBe(30);
      expect(progressReports.length).toBeGreaterThan(0);
    });

    it("should handle extremely large numbers of modified files", async () => {
      await symbolIndex.indexFiles(["test.ts"]);

      // Simulate extremely large number of modified files (e.g., 10000)
      const modifiedFiles = Array.from(
        { length: 10000 },
        (_, i) => `file${i}.ts`,
      );
      vi.mocked(gitUtils.getGitHashAsync).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: "new-hash",
        _unsafeUnwrap: () => "new-hash",
      } as any);
      vi.mocked(gitUtils.getModifiedFilesAsync).mockResolvedValueOnce({
        isOk: () => true,
        isErr: () => false,
        value: modifiedFiles,
        _unsafeUnwrap: () => modifiedFiles,
      } as any);
      vi.mocked(gitUtils.getUntrackedFilesAsync).mockResolvedValueOnce({
        isOk: () => true,
        isErr: () => false,
        value: [],
        _unsafeUnwrap: () => [],
      } as any);

      // Track memory usage
      const memoryBefore = process.memoryUsage().heapUsed / 1024 / 1024;

      const result = await symbolIndex.updateIncremental({
        batchSize: 100,
        onProgress: vi.fn(),
      });

      const memoryAfter = process.memoryUsage().heapUsed / 1024 / 1024;
      const memoryIncrease = memoryAfter - memoryBefore;

      // Should process all files
      expect(result.updated.length).toBe(10000);
      // Memory usage should not increase excessively (less than 500MB)
      expect(memoryIncrease).toBeLessThan(500);
    });

    it("should handle concurrent processing efficiently", async () => {
      await symbolIndex.indexFiles(["test.ts"]);

      // Simulate files with different processing times
      const modifiedFiles = Array.from(
        { length: 100 },
        (_, i) => `file${i}.ts`,
      );
      vi.mocked(gitUtils.getGitHashAsync).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: "new-hash",
        _unsafeUnwrap: () => "new-hash",
      } as any);
      vi.mocked(gitUtils.getModifiedFilesAsync).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: modifiedFiles,
        _unsafeUnwrap: () => modifiedFiles,
      } as any);
      vi.mocked(gitUtils.getUntrackedFilesAsync).mockResolvedValue({
        isOk: () => true,
        isErr: () => false,
        value: [],
        _unsafeUnwrap: () => [],
      } as any);

      // Mock indexFile to take variable time
      let callCount = 0;
      vi.spyOn(symbolIndex as any, "indexFile").mockImplementation(async () => {
        const delay = Math.random() * 10;
        await new Promise((resolve) => setTimeout(resolve, delay));
        callCount++;
      });

      const startTime = Date.now();

      const result = await symbolIndex.updateIncremental({
        batchSize: 10,
      });

      const elapsedTime = Date.now() - startTime;

      // Should process all files
      expect(result.updated.length).toBe(100);
      // Should be processed in reasonable time (less than 2 seconds for 100 files)
      expect(elapsedTime).toBeLessThan(2000);
      // All files should be processed
      expect(callCount).toBe(100);
    });
  });
});
