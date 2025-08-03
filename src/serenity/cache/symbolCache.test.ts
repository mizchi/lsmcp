import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { SymbolCacheManager } from "./symbolCache.ts";
import type { SymbolEntry } from "../../mcp/analysis/symbolIndex.ts";
import { SymbolKind } from "vscode-languageserver-types";

describe("SymbolCacheManager", () => {
  let testDir: string;
  let manager: SymbolCacheManager;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `serenity-cache-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    manager = new SymbolCacheManager(testDir);
  });

  afterEach(async () => {
    // Clean up
    manager.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("cacheSymbols", () => {
    it("should cache symbols and retrieve them by file", async () => {
      const testSymbols: SymbolEntry[] = [
        {
          name: "TestClass",
          kind: SymbolKind.Class,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 10, character: 1 },
            },
          },
          children: [
            {
              name: "constructor",
              kind: SymbolKind.Constructor,
              location: {
                uri: "file:///test/file.ts",
                range: {
                  start: { line: 1, character: 2 },
                  end: { line: 3, character: 3 },
                },
              },
              containerName: "TestClass",
            },
            {
              name: "method1",
              kind: SymbolKind.Method,
              location: {
                uri: "file:///test/file.ts",
                range: {
                  start: { line: 5, character: 2 },
                  end: { line: 7, character: 3 },
                },
              },
              containerName: "TestClass",
            },
          ],
        },
      ];

      await manager.cacheSymbols("test/file.ts", testSymbols, Date.now());

      const cached = manager.getSymbolsByFile("test/file.ts");
      expect(cached).toHaveLength(3); // Parent + 2 children

      const classSymbol = cached.find((s) => s.namePath === "TestClass");
      expect(classSymbol).toBeDefined();
      expect(classSymbol!.kind).toBe(SymbolKind.Class);
      expect(classSymbol!.startLine).toBe(0);
      expect(classSymbol!.endLine).toBe(10);

      const methodSymbol = cached.find((s) => s.namePath === "method1");
      expect(methodSymbol).toBeDefined();
      expect(methodSymbol!.containerName).toBe("TestClass");
    });

    it("should replace existing symbols for a file", async () => {
      const oldSymbols: SymbolEntry[] = [
        {
          name: "OldClass",
          kind: SymbolKind.Class,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 5, character: 1 },
            },
          },
        },
      ];

      const newSymbols: SymbolEntry[] = [
        {
          name: "NewClass",
          kind: SymbolKind.Class,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 10, character: 1 },
            },
          },
        },
      ];

      await manager.cacheSymbols("test/file.ts", oldSymbols, Date.now());
      await manager.cacheSymbols("test/file.ts", newSymbols, Date.now());

      const cached = manager.getSymbolsByFile("test/file.ts");
      expect(cached).toHaveLength(1);
      expect(cached[0].namePath).toBe("NewClass");
    });
  });

  describe("getSymbolsByName", () => {
    it("should retrieve symbols by name", async () => {
      const symbols: SymbolEntry[] = [
        {
          name: "findUser",
          kind: SymbolKind.Function,
          location: {
            uri: "file:///test/file1.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 5, character: 1 },
            },
          },
        },
        {
          name: "findUser",
          kind: SymbolKind.Function,
          location: {
            uri: "file:///test/file2.ts",
            range: {
              start: { line: 10, character: 0 },
              end: { line: 15, character: 1 },
            },
          },
        },
      ];

      await manager.cacheSymbols("test/file1.ts", [symbols[0]], Date.now());
      await manager.cacheSymbols("test/file2.ts", [symbols[1]], Date.now());

      const found = manager.getSymbolsByName("findUser");
      expect(found).toHaveLength(2);
      expect(found.map((s) => s.filePath).sort()).toEqual([
        "test/file1.ts",
        "test/file2.ts",
      ]);
    });
  });

  describe("searchSymbols", () => {
    it("should search symbols by pattern", async () => {
      const symbols: SymbolEntry[] = [
        {
          name: "getUserById",
          kind: SymbolKind.Function,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 5, character: 1 },
            },
          },
        },
        {
          name: "getUserByEmail",
          kind: SymbolKind.Function,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 10, character: 0 },
              end: { line: 15, character: 1 },
            },
          },
        },
        {
          name: "createUser",
          kind: SymbolKind.Function,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 20, character: 0 },
              end: { line: 25, character: 1 },
            },
          },
        },
      ];

      await manager.cacheSymbols("test/file.ts", symbols, Date.now());

      const found = manager.searchSymbols("getUserBy");
      expect(found).toHaveLength(2);
      expect(found.every((s) => s.namePath.includes("getUserBy"))).toBe(true);
    });

    it("should be case-sensitive", async () => {
      const symbols: SymbolEntry[] = [
        {
          name: "GetUser",
          kind: SymbolKind.Function,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 5, character: 1 },
            },
          },
        },
      ];

      await manager.cacheSymbols("test/file.ts", symbols, Date.now());

      const found1 = manager.searchSymbols("GetUser");
      expect(found1).toHaveLength(1);

      const found2 = manager.searchSymbols("getuser");
      expect(found2).toHaveLength(0);
    });
  });

  describe("invalidateFile", () => {
    it("should remove all symbols for a file", async () => {
      const symbols: SymbolEntry[] = [
        {
          name: "TestClass",
          kind: SymbolKind.Class,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 10, character: 1 },
            },
          },
        },
      ];

      await manager.cacheSymbols("test/file.ts", symbols, Date.now());
      expect(manager.getSymbolsByFile("test/file.ts")).toHaveLength(1);

      manager.invalidateFile("test/file.ts");
      expect(manager.getSymbolsByFile("test/file.ts")).toHaveLength(0);
    });
  });

  describe("clearCache", () => {
    it("should remove all cached symbols", async () => {
      const symbols1: SymbolEntry[] = [
        {
          name: "Symbol1",
          kind: SymbolKind.Function,
          location: {
            uri: "file:///test/file1.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 5, character: 1 },
            },
          },
        },
      ];

      const symbols2: SymbolEntry[] = [
        {
          name: "Symbol2",
          kind: SymbolKind.Function,
          location: {
            uri: "file:///test/file2.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 5, character: 1 },
            },
          },
        },
      ];

      await manager.cacheSymbols("test/file1.ts", symbols1, Date.now());
      await manager.cacheSymbols("test/file2.ts", symbols2, Date.now());

      const stats = manager.getStats();
      expect(stats.totalSymbols).toBe(2);
      expect(stats.totalFiles).toBe(2);

      manager.clearCache();

      const newStats = manager.getStats();
      expect(newStats.totalSymbols).toBe(0);
      expect(newStats.totalFiles).toBe(0);
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", async () => {
      const symbols: SymbolEntry[] = [
        {
          name: "Class1",
          kind: SymbolKind.Class,
          location: {
            uri: "file:///test/file1.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 10, character: 1 },
            },
          },
          children: [
            {
              name: "method1",
              kind: SymbolKind.Method,
              location: {
                uri: "file:///test/file1.ts",
                range: {
                  start: { line: 1, character: 2 },
                  end: { line: 3, character: 3 },
                },
              },
              containerName: "Class1",
            },
          ],
        },
        {
          name: "function1",
          kind: SymbolKind.Function,
          location: {
            uri: "file:///test/file2.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 5, character: 1 },
            },
          },
        },
      ];

      await manager.cacheSymbols("test/file1.ts", [symbols[0]], Date.now());
      await manager.cacheSymbols("test/file2.ts", [symbols[1]], Date.now());

      const stats = manager.getStats();
      expect(stats.totalSymbols).toBe(3); // Class1 + method1 + function1
      expect(stats.totalFiles).toBe(2);
    });
  });
});

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("symbolCache module", () => {
    it("exports SymbolCacheManager", () => {
      expect(SymbolCacheManager).toBeDefined();
    });
  });
}
