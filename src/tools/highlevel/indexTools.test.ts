import { describe, it, expect, beforeEach, vi } from "vitest";
import * as IndexerAdapter from "@internal/code-indexer";
import { SymbolKind } from "vscode-languageserver-types";
// Remove getLSPClient - no longer needed
import { loadIndexConfig } from "@internal/code-indexer";
import { getAdapterDefaultPattern } from "@internal/code-indexer";
import { glob } from "gitaware-glob";
import { searchSymbolsTool } from "./indexTools";

// Mock the IndexerAdapter module
vi.mock("@internal/code-indexer", () => {
  const KIND_MAP: Record<string, number> = {
    File: 1,
    Module: 2,
    Namespace: 3,
    Package: 4,
    Class: 5,
    Method: 6,
    Property: 7,
    Field: 8,
    Constructor: 9,
    Enum: 10,
    Interface: 11,
    Function: 12,
    Variable: 13,
    Constant: 14,
    String: 15,
    Number: 16,
    Boolean: 17,
    Array: 18,
    Object: 19,
    Key: 20,
    Null: 21,
    EnumMember: 22,
    Struct: 23,
    Event: 24,
    Operator: 25,
    TypeParameter: 26,
  };
  const SYMBOL_KIND_NAMES = Object.keys(KIND_MAP);
  const getSymbolKindName = (kind: number) => {
    for (const [name, id] of Object.entries(KIND_MAP)) {
      if (id === kind) return name;
    }
    return undefined;
  };
  const parseSymbolKind = (input: any) => {
    const toKind = (s: string) => {
      const key = SYMBOL_KIND_NAMES.find(
        (k) => k.toLowerCase() === String(s).toLowerCase(),
      );
      if (!key) throw new Error(`Unknown symbol kind: ${s}`);
      return KIND_MAP[key];
    };
    if (Array.isArray(input)) {
      // If any non-string provided, simulate package behavior: reject numeric kinds explicitly
      if (input.some((v) => typeof v !== "string")) {
        throw new Error("Invalid kind type: number");
      }
      return input.map(toKind);
    }
    if (typeof input === "string") return [toKind(input)];
    if (typeof input === "number") {
      throw new Error("Invalid kind type: number");
    }
    throw new Error(`Invalid kind type: ${typeof input}`);
  };

  return {
    // IndexerAdapter API
    querySymbols: vi.fn(),
    getIndexStats: vi.fn(),
    updateIndexIncremental: vi.fn(),
    getOrCreateIndex: vi.fn(),
    // Config/helpers exposed from the same package entry
    loadIndexConfig: vi.fn(),
    getAdapterDefaultPattern: vi.fn(),

    // Symbol kind helpers/constants used at module init time
    SYMBOL_KIND_NAMES,
    getSymbolKindName,
    parseSymbolKind,
  };
});

// Mock other dependencies
vi.mock("@internal/lsp-client", () => ({
  getLSPClient: vi.fn(),
}));

vi.mock("gitaware-glob", () => ({
  glob: vi.fn(),
}));

describe("searchSymbolsTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for getIndexStats to indicate index exists
    vi.mocked(IndexerAdapter.getIndexStats).mockReturnValue({
      totalFiles: 10,
      totalSymbols: 100,
      indexingTime: 1000,
      lastUpdated: new Date(),
    });

    // Default mock for updateIndexIncremental
    vi.mocked(IndexerAdapter.updateIndexIncremental).mockResolvedValue({
      success: true,
      updated: [],
      removed: [],
      errors: [],
    });
  });

  describe("Case-insensitive string kinds", () => {
    it("should accept 'Class' (proper case)", async () => {
      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([
        {
          name: "TestClass",
          kind: SymbolKind.Class,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 10, character: 0 },
            },
          },
        },
      ]);

      const result = await searchSymbolsTool.execute({
        kind: "Class",
        root: "/test",
      } as any);

      expect(result).toContain("TestClass");
      expect(result).toContain("[Class]");

      // Verify the query was called with numeric SymbolKind
      expect(IndexerAdapter.querySymbols).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          kind: SymbolKind.Class,
        }),
      );
    });

    it("should accept 'class' (lowercase)", async () => {
      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([
        {
          name: "TestClass",
          kind: SymbolKind.Class,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 10, character: 0 },
            },
          },
        },
      ]);

      const result = await searchSymbolsTool.execute({
        kind: "class",
        root: "/test",
      } as any);

      expect(result).toContain("TestClass");
      expect(IndexerAdapter.querySymbols).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          kind: SymbolKind.Class,
        }),
      );
    });

    it("should accept 'CLASS' (uppercase)", async () => {
      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([
        {
          name: "TestClass",
          kind: SymbolKind.Class,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 10, character: 0 },
            },
          },
        },
      ]);

      const result = await searchSymbolsTool.execute({
        kind: "CLASS",
        root: "/test",
      } as any);

      expect(result).toContain("TestClass");
      expect(IndexerAdapter.querySymbols).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          kind: SymbolKind.Class,
        }),
      );
    });

    it("should handle mixed case 'InTeRfAcE'", async () => {
      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([
        {
          name: "TestInterface",
          kind: SymbolKind.Interface,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 5, character: 0 },
            },
          },
        },
      ]);

      const result = await searchSymbolsTool.execute({
        kind: "InTeRfAcE",
        root: "/test",
      } as any);

      expect(result).toContain("TestInterface");
      expect(IndexerAdapter.querySymbols).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          kind: SymbolKind.Interface,
        }),
      );
    });

    it("should handle EnumMember with various cases", async () => {
      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([
        {
          name: "Active",
          kind: SymbolKind.EnumMember,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 10 },
            },
          },
        },
      ]);

      // Test different case variations
      const cases = ["EnumMember", "enummember", "ENUMMEMBER", "enumMember"];

      for (const kindCase of cases) {
        vi.clearAllMocks();
        vi.mocked(IndexerAdapter.getIndexStats).mockReturnValue({
          totalFiles: 10,
          totalSymbols: 100,
          indexingTime: 1000,
          lastUpdated: new Date(),
        });
        vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([
          {
            name: "Active",
            kind: SymbolKind.EnumMember,
            location: {
              uri: "file:///test/file.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 10 },
              },
            },
          },
        ]);

        const result = await searchSymbolsTool.execute({
          kind: kindCase,
          root: "/test",
        } as any);

        expect(result).toContain("Active");
        expect(IndexerAdapter.querySymbols).toHaveBeenCalledWith(
          "/test",
          expect.objectContaining({
            kind: SymbolKind.EnumMember,
          }),
        );
      }
    });
  });

  describe("Array of kinds", () => {
    it("should accept array with same case", async () => {
      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([
        {
          name: "TestClass",
          kind: SymbolKind.Class,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 10, character: 0 },
            },
          },
        },
        {
          name: "TestInterface",
          kind: SymbolKind.Interface,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 12, character: 0 },
              end: { line: 15, character: 0 },
            },
          },
        },
      ]);

      const result = await searchSymbolsTool.execute({
        kind: ["Class", "Interface"],
        root: "/test",
      } as any);

      expect(result).toContain("TestClass");
      expect(result).toContain("TestInterface");
      expect(IndexerAdapter.querySymbols).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          kind: [SymbolKind.Class, SymbolKind.Interface],
        }),
      );
    });

    it("should accept array with mixed case", async () => {
      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([
        {
          name: "TestClass",
          kind: SymbolKind.Class,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 10, character: 0 },
            },
          },
        },
        {
          name: "TestInterface",
          kind: SymbolKind.Interface,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 12, character: 0 },
              end: { line: 15, character: 0 },
            },
          },
        },
        {
          name: "testFunction",
          kind: SymbolKind.Function,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 17, character: 0 },
              end: { line: 20, character: 0 },
            },
          },
        },
      ]);

      const result = await searchSymbolsTool.execute({
        kind: ["class", "INTERFACE", "Function"],
        root: "/test",
      } as any);

      expect(result).toContain("TestClass");
      expect(result).toContain("TestInterface");
      expect(result).toContain("testFunction");
      expect(IndexerAdapter.querySymbols).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          kind: [SymbolKind.Class, SymbolKind.Interface, SymbolKind.Function],
        }),
      );
    });
  });

  describe("Error handling", () => {
    it("should return helpful error for invalid kind string", async () => {
      const result = await searchSymbolsTool.execute({
        kind: "InvalidKind",
        root: "/test",
      } as any);

      expect(result).toContain("Error parsing symbol kind");
      expect(result).toContain("Unknown symbol kind");
      expect(result).toContain("Valid values");
      expect(IndexerAdapter.querySymbols).not.toHaveBeenCalled();
    });

    it("should return error for numeric kind", async () => {
      const result = await searchSymbolsTool.execute({
        kind: 5, // Numbers not supported anymore
        root: "/test",
        includeChildren: true,
        includeExternal: false,
        onlyExternal: false,
      });

      expect(result).toContain("Error:");
      expect(result).toContain("Invalid kind type: number");
      expect(IndexerAdapter.querySymbols).not.toHaveBeenCalled();
    });

    it("should return error for mixed string and number array", async () => {
      const result = await searchSymbolsTool.execute({
        kind: ["Class", 11], // Mixed types not supported
        root: "/test",
        includeChildren: true,
        includeExternal: false,
        onlyExternal: false,
      });

      expect(result).toContain("Error:");
      expect(result).toContain("Invalid kind type: number");
      expect(IndexerAdapter.querySymbols).not.toHaveBeenCalled();
    });

    it("should auto-create index when empty", async () => {
      // Mock empty index
      vi.mocked(IndexerAdapter.getIndexStats).mockReturnValue({
        totalFiles: 0,
        totalSymbols: 0,
        indexingTime: 0,
        lastUpdated: new Date(),
      });

      // Mock LSP client exists
      // LSP client mocking no longer needed

      // Mock index creation
      const mockIndex = {
        indexFiles: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockReturnValue({
          totalFiles: 2,
          totalSymbols: 10,
          indexingTime: 100,
          lastUpdated: new Date(),
        }),
      };
      vi.mocked(IndexerAdapter.getOrCreateIndex).mockReturnValue(
        mockIndex as any,
      );

      // Mock config loading - return null to force using context
      vi.mocked(loadIndexConfig).mockReturnValue(null as any);

      // Mock default pattern
      vi.mocked(getAdapterDefaultPattern).mockReturnValue("**/*.{ts,tsx}");

      // Mock glob finding files  - glob returns an async generator
      vi.mocked(glob).mockReturnValue(
        (async function* () {
          yield "file1.ts";
          yield "file2.ts";
        })() as any,
      );

      // Mock query symbols after indexing
      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([
        {
          name: "TestClass",
          kind: SymbolKind.Class,
          location: {
            uri: "file:///test/file1.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 10, character: 0 },
            },
          },
        },
      ]);

      const result = await searchSymbolsTool.execute(
        {
          kind: "Class",
          root: "/test",
        } as any,
        // Pass context with preset config
        {
          config: {
            preset: "typescript-language-server",
          },
        } as any,
      );

      // Verify index creation flow
      // LSP client check no longer needed
      expect(IndexerAdapter.getOrCreateIndex).toHaveBeenCalledWith(
        "/test",
        expect.objectContaining({
          config: {
            preset: "typescript-language-server",
          },
        }),
      );
      expect(glob).toHaveBeenCalledWith("**/*.{ts,tsx}", {
        cwd: "/test",
      });
      expect(mockIndex.indexFiles).toHaveBeenCalledWith(
        ["file1.ts", "file2.ts"],
        5,
        expect.objectContaining({
          onProgress: expect.any(Function),
        }),
      );

      // Verify search was performed after indexing
      expect(IndexerAdapter.querySymbols).toHaveBeenCalled();
      expect(result).toContain("TestClass");
    });

    it("should return error when LSP client not initialized", async () => {
      vi.mocked(IndexerAdapter.getIndexStats).mockReturnValue({
        totalFiles: 0,
        totalSymbols: 0,
        indexingTime: 0,
        lastUpdated: new Date(),
      });

      // Mock index creation failure
      vi.mocked(IndexerAdapter.getOrCreateIndex).mockReturnValue(null as any);

      const result = await searchSymbolsTool.execute({
        kind: "Class",
        root: "/test",
      } as any);

      expect(result).toContain("Failed to create symbol index");
      expect(IndexerAdapter.querySymbols).not.toHaveBeenCalled();
    });

    it("should use config patterns when available", async () => {
      vi.mocked(IndexerAdapter.getIndexStats).mockReturnValue({
        totalFiles: 0,
        totalSymbols: 0,
        indexingTime: 0,
        lastUpdated: new Date(),
      });

      // LSP client mocking no longer needed

      const mockIndex = {
        indexFiles: vi.fn().mockResolvedValue(undefined),
        getStats: vi.fn().mockReturnValue({
          totalFiles: 1,
          totalSymbols: 5,
          indexingTime: 50,
          lastUpdated: new Date(),
        }),
      };
      vi.mocked(IndexerAdapter.getOrCreateIndex).mockReturnValue(
        mockIndex as any,
      );

      // Mock config with patterns
      vi.mocked(loadIndexConfig).mockReturnValue({
        files: ["src/**/*.js", "lib/**/*.js"],
        settings: { indexConcurrency: 10 },
      } as any);

      vi.mocked(glob).mockReturnValue(
        (async function* () {
          yield "src/file.js";
        })() as any,
      );

      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([]);

      await searchSymbolsTool.execute({
        kind: "Class",
        root: "/test",
      } as any);

      // Verify config patterns were used - split into separate calls
      expect(glob).toHaveBeenCalledWith("src/**/*.js", {
        cwd: "/test",
      });
      expect(glob).toHaveBeenCalledWith("lib/**/*.js", {
        cwd: "/test",
      });

      // Verify config concurrency was used
      expect(mockIndex.indexFiles).toHaveBeenCalledWith(
        ["src/file.js"],
        10,
        expect.objectContaining({
          onProgress: expect.any(Function),
        }),
      );
    });

    it("should handle no results", async () => {
      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([]);

      const result = await searchSymbolsTool.execute({
        kind: "Class",
        root: "/test",
      } as any);

      expect(result).toContain("No symbols found");
    });
  });

  describe("Combined filters", () => {
    it("should pass through all filter parameters", async () => {
      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([
        {
          name: "TestMethod",
          kind: SymbolKind.Method,
          containerName: "TestClass",
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 5, character: 2 },
              end: { line: 7, character: 3 },
            },
          },
        },
      ]);

      const result = await searchSymbolsTool.execute({
        kind: "Method",
        name: "Test",
        file: "file.ts",
        containerName: "TestClass",
        includeChildren: false,
        includeExternal: false,
        onlyExternal: false,
        root: "/test",
      });

      expect(result).toContain("TestMethod");
      expect(result).toContain("in TestClass");

      expect(IndexerAdapter.querySymbols).toHaveBeenCalledWith("/test", {
        kind: SymbolKind.Method,
        name: "Test",
        file: "file.ts",
        containerName: "TestClass",
        includeChildren: false,
        includeExternal: false,
        onlyExternal: false,
        sourceLibrary: undefined,
      });
    });
  });

  describe("Auto-indexing", () => {
    it("should auto-update index before searching", async () => {
      vi.mocked(IndexerAdapter.updateIndexIncremental).mockResolvedValue({
        success: true,
        updated: ["file1.ts", "file2.ts"],
        removed: ["old.ts"],
        errors: [],
      });

      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([
        {
          name: "TestClass",
          kind: SymbolKind.Class,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 10, character: 0 },
            },
          },
        },
      ]);

      const result = await searchSymbolsTool.execute({
        kind: "Class",
        root: "/test",
      } as any);

      // Verify updateIndexIncremental was called with context (undefined in tests)
      expect(IndexerAdapter.updateIndexIncremental).toHaveBeenCalledWith(
        "/test",
        undefined,
      );
      expect(IndexerAdapter.updateIndexIncremental).toHaveBeenCalledBefore(
        IndexerAdapter.querySymbols as any,
      );

      expect(result).toContain("TestClass");
    });

    it("should continue search even if auto-update fails", async () => {
      vi.mocked(IndexerAdapter.updateIndexIncremental).mockRejectedValue(
        new Error("Update failed"),
      );

      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([
        {
          name: "TestClass",
          kind: SymbolKind.Class,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 10, character: 0 },
            },
          },
        },
      ]);

      const result = await searchSymbolsTool.execute({
        kind: "Class",
        root: "/test",
      } as any);

      // Verify updateIndexIncremental was attempted with context (undefined in tests)
      expect(IndexerAdapter.updateIndexIncremental).toHaveBeenCalledWith(
        "/test",
        undefined,
      );

      // Search should still work
      expect(IndexerAdapter.querySymbols).toHaveBeenCalled();
      expect(result).toContain("TestClass");
    });

    it("should handle updateIndexIncremental returning no changes", async () => {
      vi.mocked(IndexerAdapter.updateIndexIncremental).mockResolvedValue({
        success: true,
        updated: [],
        removed: [],
        errors: [],
      });

      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([]);

      const result = await searchSymbolsTool.execute({
        kind: "Class",
        root: "/test",
      } as any);

      expect(IndexerAdapter.updateIndexIncremental).toHaveBeenCalledWith(
        "/test",
        undefined,
      );
      expect(result).toContain("No symbols found");
    });
  });

  describe("Result formatting", () => {
    it("should format results with all details", async () => {
      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([
        {
          name: "deprecatedMethod",
          kind: SymbolKind.Method,
          containerName: "OldClass",
          deprecated: true,
          detail: "() => void",
          location: {
            uri: "file:///test/src/old.ts",
            range: {
              start: { line: 10, character: 4 },
              end: { line: 12, character: 5 },
            },
          },
        },
      ]);

      const result = await searchSymbolsTool.execute({
        kind: "Method",
        root: "/test",
      } as any);

      expect(result).toContain("deprecatedMethod [Method]");
      expect(result).toContain("in OldClass");
      expect(result).toContain("(deprecated)");
      expect(result).toContain("() => void");
      expect(result).toContain("src/old.ts:11:5");
    });

    it("should limit results to 50", async () => {
      // Create 60 mock symbols
      const symbols = Array.from({ length: 60 }, (_, i) => ({
        name: `Symbol${i}`,
        kind: SymbolKind.Class,
        location: {
          uri: `file:///test/file${i}.ts`,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 10, character: 0 },
          },
        },
      }));

      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue(symbols);

      const result = await searchSymbolsTool.execute({
        kind: "Class",
        root: "/test",
      } as any);

      expect(result).toContain("Found 60 symbol(s)");
      expect(result).toContain("1. Symbol0");
      expect(result).toContain("9. Symbol8");
      expect(result).toContain("10. Symbol9");
      expect(result).not.toContain("Symbol10");
      expect(result).toContain("... and 50 more results");
    });
  });
});
