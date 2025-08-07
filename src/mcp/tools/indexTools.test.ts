import { describe, it, expect, beforeEach, vi } from "vitest";
import { searchSymbolFromIndexTool } from "./indexTools.ts";
import * as IndexerAdapter from "../../indexer/mcp/IndexerAdapter.ts";
import { SymbolKind } from "vscode-languageserver-types";

// Mock the IndexerAdapter module
vi.mock("../../indexer/mcp/IndexerAdapter.ts", () => ({
  querySymbols: vi.fn(),
  getIndexStats: vi.fn(),
}));

describe("searchSymbolFromIndexTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for getIndexStats to indicate index exists
    vi.mocked(IndexerAdapter.getIndexStats).mockReturnValue({
      totalFiles: 10,
      totalSymbols: 100,
      indexingTime: 1000,
      lastUpdated: new Date(),
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

      const result = await searchSymbolFromIndexTool.execute({
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

      const result = await searchSymbolFromIndexTool.execute({
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

      const result = await searchSymbolFromIndexTool.execute({
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

      const result = await searchSymbolFromIndexTool.execute({
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

        const result = await searchSymbolFromIndexTool.execute({
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

      const result = await searchSymbolFromIndexTool.execute({
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

      const result = await searchSymbolFromIndexTool.execute({
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
      const result = await searchSymbolFromIndexTool.execute({
        kind: "InvalidKind",
        root: "/test",
      } as any);

      expect(result).toContain("Error parsing symbol kind");
      expect(result).toContain("Unknown symbol kind");
      expect(result).toContain("Valid values");
      expect(IndexerAdapter.querySymbols).not.toHaveBeenCalled();
    });

    it("should return error for numeric kind", async () => {
      const result = await searchSymbolFromIndexTool.execute({
        // @ts-expect-error - Testing invalid type
        kind: 5,
        root: "/test",
      });

      expect(result).toContain("Error parsing symbol kind");
      expect(result).toContain("Invalid kind type: number");
      expect(IndexerAdapter.querySymbols).not.toHaveBeenCalled();
    });

    it("should return error for mixed string and number array", async () => {
      const result = await searchSymbolFromIndexTool.execute({
        // @ts-expect-error - Testing invalid type
        kind: ["Class", 11],
        root: "/test",
      });

      expect(result).toContain("Error parsing symbol kind");
      expect(result).toContain("Invalid kind type: number");
      expect(IndexerAdapter.querySymbols).not.toHaveBeenCalled();
    });

    it("should handle empty index", async () => {
      vi.mocked(IndexerAdapter.getIndexStats).mockReturnValue({
        totalFiles: 0,
        totalSymbols: 0,
        indexingTime: 0,
        lastUpdated: new Date(),
      });

      const result = await searchSymbolFromIndexTool.execute({
        kind: "Class",
        root: "/test",
      } as any);

      expect(result).toContain("No files indexed");
      expect(IndexerAdapter.querySymbols).not.toHaveBeenCalled();
    });

    it("should handle no results", async () => {
      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([]);

      const result = await searchSymbolFromIndexTool.execute({
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

      const result = await searchSymbolFromIndexTool.execute({
        kind: "Method",
        name: "Test",
        file: "file.ts",
        containerName: "TestClass",
        includeChildren: false,
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
      });
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

      const result = await searchSymbolFromIndexTool.execute({
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

      const result = await searchSymbolFromIndexTool.execute({
        kind: "Class",
        root: "/test",
      } as any);

      expect(result).toContain("Found 60 symbol(s)");
      expect(result).toContain("Symbol0");
      expect(result).toContain("Symbol49");
      expect(result).not.toContain("Symbol50");
      expect(result).toContain("... and 10 more results");
    });
  });
});
