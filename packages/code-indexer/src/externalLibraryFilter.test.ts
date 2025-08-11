import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  querySymbols,
  addSymbolToIndices,
  type SymbolIndexState,
  type SymbolEntry,
} from "./symbolIndex.ts";
import { SymbolKind } from "vscode-languageserver-types";

describe("External Library Symbol Filtering", () => {
  let tempDir: string;
  let state: SymbolIndexState;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "lsmcp-filter-test-"));
    // Create a private instance of symbol index state
    state = {
      fileIndex: new Map(),
      symbolIndex: new Map(),
      kindIndex: new Map(),
      containerIndex: new Map(),
      fileWatchers: new Map(),
      indexingQueue: new Set(),
      isIndexing: false,
      rootPath: tempDir,
      client: null,
      stats: {
        totalFiles: 0,
        totalSymbols: 0,
        indexingTime: 0,
        lastUpdated: new Date(),
      },
      eventEmitter: new (await import("events")).EventEmitter(),
    };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("Symbol filtering by external flag", () => {
    beforeEach(() => {
      // Add internal symbols
      const internalSymbol1: SymbolEntry = {
        name: "internalFunction",
        kind: SymbolKind.Function,
        location: {
          uri: "file:///project/src/utils.ts",
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 10 },
          },
        },
      };

      const internalSymbol2: SymbolEntry = {
        name: "MyClass",
        kind: SymbolKind.Class,
        location: {
          uri: "file:///project/src/index.ts",
          range: {
            start: { line: 5, character: 0 },
            end: { line: 10, character: 1 },
          },
        },
      };

      // Add external symbols
      const externalSymbol1: SymbolEntry = {
        name: "ok",
        kind: SymbolKind.Function,
        location: {
          uri: "file:///project/node_modules/neverthrow/index.d.ts",
          range: {
            start: { line: 20, character: 0 },
            end: { line: 20, character: 50 },
          },
        },
        isExternal: true,
        sourceLibrary: "neverthrow",
      };

      const externalSymbol2: SymbolEntry = {
        name: "Ok",
        kind: SymbolKind.Interface,
        location: {
          uri: "file:///project/node_modules/neverthrow/index.d.ts",
          range: {
            start: { line: 10, character: 0 },
            end: { line: 15, character: 1 },
          },
        },
        isExternal: true,
        sourceLibrary: "neverthrow",
      };

      const externalSymbol3: SymbolEntry = {
        name: "readFile",
        kind: SymbolKind.Function,
        location: {
          uri: "file:///project/node_modules/@types/node/fs.d.ts",
          range: {
            start: { line: 100, character: 0 },
            end: { line: 100, character: 50 },
          },
        },
        isExternal: true,
        sourceLibrary: "@types/node",
      };

      // Add all symbols to indices
      [
        internalSymbol1,
        internalSymbol2,
        externalSymbol1,
        externalSymbol2,
        externalSymbol3,
      ].forEach((symbol) =>
        addSymbolToIndices(state, symbol, symbol.location.uri),
      );

      // Add to file index
      state.fileIndex.set("file:///project/src/utils.ts", {
        uri: "file:///project/src/utils.ts",
        lastModified: Date.now(),
        symbols: [internalSymbol1],
      });

      state.fileIndex.set("file:///project/src/index.ts", {
        uri: "file:///project/src/index.ts",
        lastModified: Date.now(),
        symbols: [internalSymbol2],
      });

      state.fileIndex.set(
        "file:///project/node_modules/neverthrow/index.d.ts",
        {
          uri: "file:///project/node_modules/neverthrow/index.d.ts",
          lastModified: Date.now(),
          symbols: [externalSymbol1, externalSymbol2],
        },
      );

      state.fileIndex.set("file:///project/node_modules/@types/node/fs.d.ts", {
        uri: "file:///project/node_modules/@types/node/fs.d.ts",
        lastModified: Date.now(),
        symbols: [externalSymbol3],
      });
    });

    it("should exclude external symbols by default", () => {
      const results = querySymbols(state, {
        includeExternal: false,
      });

      expect(results).toHaveLength(2);
      expect(results.every((s) => !s.isExternal)).toBe(true);
      expect(results.map((s) => s.name)).toContain("internalFunction");
      expect(results.map((s) => s.name)).toContain("MyClass");
    });

    it("should include both internal and external symbols when includeExternal is true", () => {
      const results = querySymbols(state, {
        includeExternal: true,
      });

      expect(results).toHaveLength(5);
      expect(results.map((s) => s.name)).toContain("internalFunction");
      expect(results.map((s) => s.name)).toContain("MyClass");
      expect(results.map((s) => s.name)).toContain("ok");
      expect(results.map((s) => s.name)).toContain("Ok");
      expect(results.map((s) => s.name)).toContain("readFile");
    });

    it("should return only external symbols when onlyExternal is true", () => {
      const results = querySymbols(state, {
        onlyExternal: true,
      });

      expect(results).toHaveLength(3);
      expect(results.every((s) => s.isExternal)).toBe(true);
      expect(results.map((s) => s.name)).toContain("ok");
      expect(results.map((s) => s.name)).toContain("Ok");
      expect(results.map((s) => s.name)).toContain("readFile");
    });

    it("should filter by specific library", () => {
      const results = querySymbols(state, {
        onlyExternal: true,
        sourceLibrary: "neverthrow",
      });

      expect(results).toHaveLength(2);
      expect(results.every((s) => s.sourceLibrary === "neverthrow")).toBe(true);
      expect(results.map((s) => s.name)).toContain("ok");
      expect(results.map((s) => s.name)).toContain("Ok");
    });

    it("should combine name search with external filtering", () => {
      const results = querySymbols(state, {
        name: "ok",
        includeExternal: true,
      });

      // Should find "ok" from neverthrow
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("ok");
      expect(results[0].isExternal).toBe(true);
      expect(results[0].sourceLibrary).toBe("neverthrow");
    });

    it("should combine kind filter with external filtering", () => {
      const results = querySymbols(state, {
        kind: SymbolKind.Function,
        onlyExternal: true,
      });

      expect(results).toHaveLength(2);
      expect(results.every((s) => s.kind === SymbolKind.Function)).toBe(true);
      expect(results.every((s) => s.isExternal)).toBe(true);
      expect(results.map((s) => s.name)).toContain("ok");
      expect(results.map((s) => s.name)).toContain("readFile");
    });

    it("should search internal symbols only by default", () => {
      const results = querySymbols(state, {
        name: "MyClass",
        // includeExternal defaults to false
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("MyClass");
      expect(results[0].isExternal).not.toBe(true);
    });

    it("should not find external symbols when includeExternal is false", () => {
      const results = querySymbols(state, {
        name: "ok",
        includeExternal: false,
      });

      expect(results).toHaveLength(0);
    });
  });

  describe("Library name extraction", () => {
    it("should extract regular package names", () => {
      const extractLibraryName = (uri: string): string => {
        const match = uri.match(
          /node_modules[\/\\](@[^\/\\]+[\/\\][^\/\\]+|[^\/\\]+)/,
        );
        if (match) {
          return match[1];
        }
        return "unknown";
      };

      expect(
        extractLibraryName(
          "file:///project/node_modules/neverthrow/index.d.ts",
        ),
      ).toBe("neverthrow");

      expect(
        extractLibraryName(
          "file:///project/node_modules/@types/node/index.d.ts",
        ),
      ).toBe("@types/node");

      expect(
        extractLibraryName(
          "file:///project/node_modules/@angular/core/index.d.ts",
        ),
      ).toBe("@angular/core");

      expect(extractLibraryName("file:///project/src/index.ts")).toBe(
        "unknown",
      );
    });
  });
});
