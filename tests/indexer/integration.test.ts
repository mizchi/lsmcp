/**
 * Integration tests for indexer
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SymbolIndex, MemoryCache } from "@lsmcp/code-indexer";
import { createLSPSymbolProvider, type LSPClient } from "@lsmcp/lsp-client";
import { SymbolKind } from "vscode-languageserver-types";

describe("Indexer Integration", () => {
  let symbolIndex: SymbolIndex;
  let mockLSPClient: LSPClient;

  beforeEach(() => {
    // Mock LSP client
    mockLSPClient = {
      getDocumentSymbols: vi.fn(),
      openDocument: vi.fn(),
      closeDocument: vi.fn(),
    } as any;

    // Mock file system
    const mockFileSystem = {
      readFile: vi.fn().mockResolvedValue(`
        export class TestClass {
          constructor() {}
          
          testMethod(): void {
            console.log("test");
          }
        }
        
        export function testFunction() {
          return "hello";
        }
      `),
      exists: vi.fn().mockResolvedValue(true),
      stat: vi.fn().mockResolvedValue({ mtime: new Date() }),
    };

    // Create symbol provider
    const symbolProvider = createLSPSymbolProvider(
      mockLSPClient,
      async (uri: string) => {
        const path = uri.replace("file://", "");
        return await mockFileSystem.readFile(path);
      },
    );

    // Create cache
    const cache = new MemoryCache();

    // Create index
    symbolIndex = new SymbolIndex(
      "/test/project",
      symbolProvider,
      mockFileSystem,
      cache,
    );
  });

  it("should index TypeScript file and query symbols", async () => {
    // Mock LSP response
    vi.mocked(mockLSPClient.getDocumentSymbols).mockResolvedValue([
      {
        name: "TestClass",
        kind: SymbolKind.Class,
        range: {
          start: { line: 1, character: 0 },
          end: { line: 8, character: 0 },
        },
        selectionRange: {
          start: { line: 1, character: 0 },
          end: { line: 8, character: 0 },
        },
        children: [
          {
            name: "constructor",
            kind: SymbolKind.Constructor,
            range: {
              start: { line: 2, character: 2 },
              end: { line: 2, character: 20 },
            },
            selectionRange: {
              start: { line: 2, character: 2 },
              end: { line: 2, character: 20 },
            },
          },
          {
            name: "testMethod",
            kind: SymbolKind.Method,
            range: {
              start: { line: 4, character: 2 },
              end: { line: 6, character: 3 },
            },
            selectionRange: {
              start: { line: 4, character: 2 },
              end: { line: 6, character: 3 },
            },
          },
        ],
      },
      {
        name: "testFunction",
        kind: SymbolKind.Function,
        range: {
          start: { line: 10, character: 0 },
          end: { line: 12, character: 1 },
        },
        selectionRange: {
          start: { line: 10, character: 0 },
          end: { line: 12, character: 1 },
        },
      },
    ]);

    // Index file
    await symbolIndex.indexFile("src/test.ts");

    // Query all symbols
    const allSymbols = symbolIndex.querySymbols({});
    expect(allSymbols.length).toBe(4); // Class + constructor + method + function

    // Query by name (case-insensitive, so includes TestClass)
    const testSymbols = symbolIndex.querySymbols({ name: "test" });
    expect(testSymbols.length).toBe(3); // TestClass + testMethod + testFunction (includeChildren defaults to true)

    // Query by kind
    const methods = symbolIndex.querySymbols({ kind: SymbolKind.Method });
    expect(methods.length).toBe(1);
    expect(methods[0].name).toBe("testMethod");

    // Query class members
    const classMembers = symbolIndex.querySymbols({
      containerName: "TestClass",
    });
    expect(classMembers.length).toBe(2); // constructor + method

    // Check stats
    const stats = symbolIndex.getStats();
    expect(stats.totalFiles).toBe(1);
    expect(stats.totalSymbols).toBe(4);
  });

  it("should handle multiple files", async () => {
    // Mock different symbols for different files
    let callCount = 0;
    vi.mocked(mockLSPClient.getDocumentSymbols).mockImplementation(
      async (uri: string) => {
        callCount++;
        if (uri.includes("file1")) {
          return [
            {
              name: "File1Class",
              kind: SymbolKind.Class,
              range: {
                start: { line: 0, character: 0 },
                end: { line: 5, character: 0 },
              },
              selectionRange: {
                start: { line: 0, character: 0 },
                end: { line: 5, character: 0 },
              },
            },
          ];
        } else if (uri.includes("file2")) {
          return [
            {
              name: "File2Function",
              kind: SymbolKind.Function,
              range: {
                start: { line: 0, character: 0 },
                end: { line: 3, character: 0 },
              },
              selectionRange: {
                start: { line: 0, character: 0 },
                end: { line: 3, character: 0 },
              },
            },
          ];
        }
        return [];
      },
    );

    // Index multiple files
    await symbolIndex.indexFiles(["src/file1.ts", "src/file2.ts"]);

    // Query all
    const allSymbols = symbolIndex.querySymbols({});
    expect(allSymbols.length).toBe(2);

    // Query by file
    const file1Symbols = symbolIndex.querySymbols({ file: "src/file1.ts" });
    expect(file1Symbols.length).toBe(1);
    expect(file1Symbols[0].name).toBe("File1Class");

    const file2Symbols = symbolIndex.querySymbols({ file: "src/file2.ts" });
    expect(file2Symbols.length).toBe(1);
    expect(file2Symbols[0].name).toBe("File2Function");
  });

  it("should use cache on second index", async () => {
    const symbols = [
      {
        name: "CachedSymbol",
        kind: SymbolKind.Variable,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 20 },
        },
        selectionRange: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 20 },
        },
      },
    ];

    vi.mocked(mockLSPClient.getDocumentSymbols).mockResolvedValue(symbols);

    // First index - should call LSP
    await symbolIndex.indexFile("cached.ts");
    expect(mockLSPClient.getDocumentSymbols).toHaveBeenCalledTimes(1);

    // Clear the index but keep cache
    symbolIndex.clear();

    // Second index - should use cache
    await symbolIndex.indexFile("cached.ts");

    // Should still have only been called once
    expect(mockLSPClient.getDocumentSymbols).toHaveBeenCalledTimes(1);

    // Verify symbol is there
    const results = symbolIndex.querySymbols({ name: "CachedSymbol" });
    expect(results.length).toBe(1);
  });
});
