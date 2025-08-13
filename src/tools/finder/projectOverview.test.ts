import { describe, it, expect, beforeEach, vi } from "vitest";
import * as IndexerAdapter from "@lsmcp/code-indexer";
import * as fs from "fs/promises";
import * as path from "path";
import { SymbolKind } from "vscode-languageserver-types";

// Mock the dependencies
vi.mock("@lsmcp/code-indexer", () => ({
  getOrCreateIndex: vi.fn(),
  getIndexStats: vi.fn(),
  querySymbols: vi.fn(),
  loadIndexConfig: vi.fn(),
  getAdapterDefaultPattern: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  access: vi.fn(),
}));

vi.mock("@lsmcp/lsp-client", () => ({
  getLSPClient: vi.fn(),
}));

/* loadIndexConfig is mocked via @lsmcp/code-indexer above */

/* getAdapterDefaultPattern is mocked via @lsmcp/code-indexer above */

vi.mock("gitaware-glob", () => ({
  glob: vi.fn(),
}));

import { glob } from "gitaware-glob";
// Remove getLSPClient - no longer needed
import { getAdapterDefaultPattern, loadIndexConfig } from "@lsmcp/code-indexer";
import { getProjectOverviewTool } from "./projectOverview";

describe("getProjectOverviewTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset glob mock
    vi.mocked(glob).mockReturnValue(
      (async function* () {
        yield "file1.ts";
        yield "file2.ts";
      })() as any,
    );

    // LSP client mocking no longer needed

    // Setup default adapter pattern
    vi.mocked(getAdapterDefaultPattern).mockReturnValue("**/*.{ts,tsx}");

    // Setup default config
    vi.mocked(loadIndexConfig).mockReturnValue(null as any);
  });

  it("should return project overview with basic structure", async () => {
    const mockRoot = "/test/project";

    // Mock package.json
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      if (filePath === path.join(mockRoot, "package.json")) {
        return JSON.stringify({
          name: "test-project",
          version: "1.0.0",
          description: "A test project",
          dependencies: {
            express: "^4.18.0",
            typescript: "^5.0.0",
          },
        });
      }
      throw new Error("File not found");
    });

    // Mock index stats
    vi.mocked(IndexerAdapter.getIndexStats).mockReturnValue({
      totalFiles: 10,
      totalSymbols: 50,
      indexingTime: 1000,
      lastUpdated: new Date(),
    });

    // Mock symbols for overview
    vi.mocked(IndexerAdapter.querySymbols).mockImplementation((_, query) => {
      if (query.kind === SymbolKind.Class) {
        return [
          {
            name: "UserController",
            kind: SymbolKind.Class,
            location: {
              uri: "file:///test/file.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
            },
          },
          {
            name: "AuthService",
            kind: SymbolKind.Class,
            location: {
              uri: "file:///test/file.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
            },
          },
          {
            name: "DatabaseConnection",
            kind: SymbolKind.Class,
            location: {
              uri: "file:///test/file.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
            },
          },
        ];
      }
      if (query.kind === SymbolKind.Interface) {
        return [
          {
            name: "IUser",
            kind: SymbolKind.Interface,
            location: {
              uri: "file:///test/file.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
            },
          },
          {
            name: "IAuthToken",
            kind: SymbolKind.Interface,
            location: {
              uri: "file:///test/file.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
            },
          },
        ];
      }
      if (query.kind === SymbolKind.Function) {
        return [
          {
            name: "main",
            kind: SymbolKind.Function,
            location: {
              uri: "file:///test/file.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
            },
          },
          {
            name: "initializeApp",
            kind: SymbolKind.Function,
            location: {
              uri: "file:///test/file.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
            },
          },
          {
            name: "connectDatabase",
            kind: SymbolKind.Function,
            location: {
              uri: "file:///test/file.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
            },
          },
          {
            name: "startServer",
            kind: SymbolKind.Function,
            location: {
              uri: "file:///test/file.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
            },
          },
          {
            name: "handleRequest",
            kind: SymbolKind.Function,
            location: {
              uri: "file:///test/file.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
            },
          },
        ];
      }
      return [];
    });

    const result = await getProjectOverviewTool.execute({ root: mockRoot });

    // Should contain project info
    expect(result).toContain("**Project:** test-project v1.0.0");
    expect(result).toContain("A test project");

    // Should contain statistics
    expect(result).toContain("### Statistics:");
    expect(result).toContain("**Files:** 10");
    expect(result).toContain("**Symbols:** 50");

    // Should contain key symbols
    expect(result).toContain("### Key Components:");
    expect(result).toContain("**Classes** (3):");
    expect(result).toContain("• UserController");
    expect(result).toContain("• AuthService");
    expect(result).toContain("• DatabaseConnection");

    expect(result).toContain("**Interfaces** (2):");
    expect(result).toContain("• IUser");
    expect(result).toContain("• IAuthToken");

    expect(result).toContain("**Functions & Methods** (5 total):");
    expect(result).toContain("• main");
    expect(result).toContain("• initializeApp");

    // Should contain dependencies
    expect(result).toContain("### Dependencies:");
    expect(result).toContain("• express");
    expect(result).toContain("• typescript");
  });

  it("should handle missing package.json gracefully", async () => {
    const mockRoot = "/test/project";

    // Mock no package.json
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

    // Mock index stats
    vi.mocked(IndexerAdapter.getIndexStats).mockReturnValue({
      totalFiles: 5,
      totalSymbols: 20,
      indexingTime: 500,
      lastUpdated: new Date(),
    });

    // Mock minimal symbols
    vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([]);

    const result = await getProjectOverviewTool.execute({ root: mockRoot });

    expect(result).toContain("Project Overview");
    expect(result).toContain("### Statistics:");
    expect(result).toContain("**Files:** 5");
    expect(result).toContain("**Symbols:** 20");
    expect(result).not.toContain("package.json");
  });

  it("should auto-create index if not exists", async () => {
    const mockRoot = "/test/project";

    // Mock no index initially
    vi.mocked(IndexerAdapter.getIndexStats).mockReturnValueOnce({
      totalFiles: 0,
      totalSymbols: 0,
      indexingTime: 0,
      lastUpdated: new Date(),
    });

    // Mock index creation
    const mockIndex = {
      indexFiles: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn().mockReturnValue({
        totalFiles: 3,
        totalSymbols: 15,
        indexingTime: 100,
        lastUpdated: new Date(),
      }),
    };
    vi.mocked(IndexerAdapter.getOrCreateIndex).mockReturnValue(
      mockIndex as any,
    );

    // After indexing, return stats
    vi.mocked(IndexerAdapter.getIndexStats).mockReturnValueOnce({
      totalFiles: 3,
      totalSymbols: 15,
      indexingTime: 100,
      lastUpdated: new Date(),
    });

    vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([]);
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

    const result = await getProjectOverviewTool.execute({ root: mockRoot });

    // Verify index was created
    expect(IndexerAdapter.getOrCreateIndex).toHaveBeenCalledWith(
      mockRoot,
      null,
    );
    expect(result).toContain("**Files:** 3");
    expect(result).toContain("**Symbols:** 15");
  });

  it("should limit output for large projects", async () => {
    const mockRoot = "/test/project";

    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

    vi.mocked(IndexerAdapter.getIndexStats).mockReturnValue({
      totalFiles: 1000,
      totalSymbols: 5000,
      indexingTime: 10000,
      lastUpdated: new Date(),
    });

    // Mock many symbols
    const manyClasses = Array.from({ length: 50 }, (_, i) => ({
      name: `Class${i}`,
      kind: SymbolKind.Class,
    }));

    vi.mocked(IndexerAdapter.querySymbols).mockImplementation((_, query) => {
      if (query.kind === SymbolKind.Class) {
        return manyClasses.map((c) => ({
          ...c,
          location: {
            uri: "file:///test/file.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 0 },
            },
          },
        }));
      }
      return [];
    });

    const result = await getProjectOverviewTool.execute({ root: mockRoot });

    // Should limit classes to top 10
    expect(result).toContain("**Classes** (50):");
    expect(result).toContain("• Class0");
    expect(result).toContain("• Class9");
    expect(result).not.toContain("• Class10");
    expect(result).toContain("... and 40 more");
  });

  it("should identify project type from dependencies", async () => {
    const mockRoot = "/test/project";

    // Mock React project
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      if (filePath === path.join(mockRoot, "package.json")) {
        return JSON.stringify({
          name: "react-app",
          dependencies: {
            react: "^18.0.0",
            "react-dom": "^18.0.0",
            "@types/react": "^18.0.0",
          },
        });
      }
      throw new Error("File not found");
    });

    vi.mocked(IndexerAdapter.getIndexStats).mockReturnValue({
      totalFiles: 20,
      totalSymbols: 100,
      indexingTime: 1000,
      lastUpdated: new Date(),
    });

    vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([]);

    const result = await getProjectOverviewTool.execute({ root: mockRoot });

    expect(result).toContain("**Type:** React Application");
  });

  it("should show directory structure summary", async () => {
    const mockRoot = "/test/project";

    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

    vi.mocked(IndexerAdapter.getIndexStats).mockReturnValue({
      totalFiles: 10,
      totalSymbols: 50,
      indexingTime: 1000,
      lastUpdated: new Date(),
    });

    // Mock file locations from symbols
    vi.mocked(IndexerAdapter.querySymbols).mockImplementation((_, query) => {
      if (!query.kind) {
        // Return all symbols with location info for directory analysis
        return [
          {
            name: "func1",
            kind: SymbolKind.Function,
            location: {
              uri: "file:///test/project/src/index.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
            },
          },
          {
            name: "func2",
            kind: SymbolKind.Function,
            location: {
              uri: "file:///test/project/src/utils/helper.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
            },
          },
          {
            name: "func3",
            kind: SymbolKind.Function,
            location: {
              uri: "file:///test/project/tests/index.test.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
            },
          },
          {
            name: "func4",
            kind: SymbolKind.Function,
            location: {
              uri: "file:///test/project/src/components/Button.tsx",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 0 },
              },
            },
          },
        ];
      }
      return [];
    });

    const result = await getProjectOverviewTool.execute({ root: mockRoot });

    expect(result).toContain("### Structure:");
    expect(result).toContain("src/");
    expect(result).toContain("tests/");
  });
});
