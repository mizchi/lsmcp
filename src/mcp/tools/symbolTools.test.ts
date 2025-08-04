import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSymbolsOverviewTool } from "./symbolTools.ts";
import * as IndexerAdapter from "../../indexer/mcp/IndexerAdapter.ts";
import * as gitignoreUtils from "../../core/io/gitignoreUtils.ts";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import { globSync } from "glob";
import { SymbolKind } from "vscode-languageserver-types";

// Mock modules
vi.mock("../../indexer/mcp/IndexerAdapter.ts", () => ({
  getOrCreateIndex: vi.fn(),
  indexFiles: vi.fn(),
  querySymbols: vi.fn(),
}));

vi.mock("../../core/io/gitignoreUtils.ts", () => ({
  createGitignoreFilter: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  stat: vi.fn(),
}));

vi.mock("glob", () => ({
  globSync: vi.fn(),
}));

describe("getSymbolsOverviewTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should return error when path does not exist", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = await getSymbolsOverviewTool.execute({
      relativePath: "non-existent-path",
      maxAnswerChars: 200000,
    });

    expect(result).toBe(
      JSON.stringify({ error: "Path not found: non-existent-path" }),
    );
  });

  it("should return error when index creation fails", async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(IndexerAdapter.getOrCreateIndex).mockReturnValue(null);

    const result = await getSymbolsOverviewTool.execute({
      relativePath: "some-path",
      maxAnswerChars: 200000,
    });

    expect(result).toBe(
      JSON.stringify({
        error: "Failed to create symbol index. Make sure LSP is running.",
      }),
    );
  });

  describe("directory processing", () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(IndexerAdapter.getOrCreateIndex).mockReturnValue({} as any);
      vi.mocked(gitignoreUtils.createGitignoreFilter).mockResolvedValue(
        () => false,
      );
    });

    it("should handle directory with TypeScript files", async () => {
      // Mock file system stat to return directory
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      // Mock glob to return TypeScript files
      vi.mocked(globSync).mockReturnValue([
        "src/serenity/tools/index.ts",
        "src/serenity/tools/symbolTools.ts",
        "src/serenity/tools/fileSystemTools.ts",
      ]);

      // Mock indexFiles to return success
      vi.mocked(IndexerAdapter.indexFiles).mockResolvedValue({
        success: true,
        totalFiles: 3,
        totalSymbols: 10,
        duration: 100,
        errors: [],
      });

      // Mock querySymbols to return symbols for each file
      vi.mocked(IndexerAdapter.querySymbols)
        .mockReturnValueOnce([
          {
            name: "exportedFunction",
            containerName: undefined,
            kind: SymbolKind.Function,
            location: {
              uri: "file:///test/src/serenity/tools/index.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 10 },
              },
            },
            detail: undefined,
            deprecated: false,
          },
          {
            name: "exportedClass",
            containerName: undefined,
            kind: SymbolKind.Class,
            location: {
              uri: "file:///test/src/serenity/tools/index.ts",
              range: {
                start: { line: 1, character: 0 },
                end: { line: 1, character: 10 },
              },
            },
            detail: undefined,
            deprecated: false,
          },
        ])
        .mockReturnValueOnce([
          {
            name: "getSymbolsOverviewTool",
            containerName: undefined,
            kind: SymbolKind.Variable,
            location: {
              uri: "file:///test/src/serenity/tools/symbolTools.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 10 },
              },
            },
            detail: undefined,
            deprecated: false,
          },
        ])
        .mockReturnValueOnce([
          {
            name: "readFileTool",
            containerName: undefined,
            kind: SymbolKind.Variable,
            location: {
              uri: "file:///test/src/serenity/tools/fileSystemTools.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 10 },
              },
            },
            detail: undefined,
            deprecated: false,
          },
          {
            name: "writeFileTool",
            containerName: undefined,
            kind: SymbolKind.Variable,
            location: {
              uri: "file:///test/src/serenity/tools/fileSystemTools.ts",
              range: {
                start: { line: 1, character: 0 },
                end: { line: 1, character: 10 },
              },
            },
            detail: undefined,
            deprecated: false,
          },
        ]);

      const result = await getSymbolsOverviewTool.execute({
        relativePath: "src/serenity/tools",
        maxAnswerChars: 200000,
      });

      const parsed = JSON.parse(result);
      expect(parsed).toEqual({
        "src/serenity/tools/index.ts": [
          { name_path: "exportedFunction", kind: "function" },
          { name_path: "exportedClass", kind: "class" },
        ],
        "src/serenity/tools/symbolTools.ts": [
          { name_path: "getSymbolsOverviewTool", kind: "variable" },
        ],
        "src/serenity/tools/fileSystemTools.ts": [
          { name_path: "readFileTool", kind: "variable" },
          { name_path: "writeFileTool", kind: "variable" },
        ],
      });

      // Verify glob was called with correct pattern
      expect(globSync).toHaveBeenCalledWith(
        "src/serenity/tools/**/*.{ts,tsx,js,jsx,py,java,cpp,c,h,hpp,cs,rb,go,rs,php,swift,kt,scala,r,m,mm}",
        {
          cwd: process.cwd(),
          ignore: ["**/node_modules/**", "**/.git/**"],
          nodir: true,
        },
      );

      // Verify indexFiles was called
      expect(IndexerAdapter.indexFiles).toHaveBeenCalledWith(process.cwd(), [
        "src/serenity/tools/index.ts",
        "src/serenity/tools/symbolTools.ts",
        "src/serenity/tools/fileSystemTools.ts",
      ]);
    });

    it("should handle single file", async () => {
      // Mock file system stat to return file
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
      } as any);

      // Mock indexFiles to return success
      vi.mocked(IndexerAdapter.indexFiles).mockResolvedValue({
        success: true,
        totalFiles: 1,
        totalSymbols: 3,
        duration: 50,
        errors: [],
      });

      // Mock querySymbols
      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([
        {
          name: "someFunction",
          containerName: undefined,
          kind: SymbolKind.Function,
          location: {
            uri: "file:///test/src/someFile.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 10 },
            },
          },
          detail: undefined,
          deprecated: false,
        },
      ]);

      const result = await getSymbolsOverviewTool.execute({
        relativePath: "src/someFile.ts",
        maxAnswerChars: 200000,
      });

      const parsed = JSON.parse(result);
      expect(parsed).toEqual({
        "src/someFile.ts": [{ name_path: "someFunction", kind: "function" }],
      });

      // Verify glob was NOT called for single file
      expect(globSync).not.toHaveBeenCalled();
    });

    it("should handle empty directory", async () => {
      // Mock file system stat to return directory
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      // Mock glob to return empty array
      vi.mocked(globSync).mockReturnValue([]);

      const result = await getSymbolsOverviewTool.execute({
        relativePath: "src/empty-dir",
        maxAnswerChars: 200000,
      });

      expect(result).toBe("{}");

      // Verify indexFiles was NOT called with empty file list
      expect(IndexerAdapter.indexFiles).not.toHaveBeenCalled();
    });

    it("should filter out gitignored files", async () => {
      // Mock file system stat to return directory
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      // Mock glob to return files including gitignored ones
      vi.mocked(globSync).mockReturnValue([
        "src/file1.ts",
        "src/node_modules/file2.ts",
        "src/file3.ts",
      ]);

      // Mock gitignore filter to filter out node_modules
      vi.mocked(gitignoreUtils.createGitignoreFilter).mockResolvedValue(
        (path: string) => path.includes("node_modules"),
      );

      // Mock indexFiles
      vi.mocked(IndexerAdapter.indexFiles).mockResolvedValue({
        success: true,
        totalFiles: 2,
        totalSymbols: 5,
        duration: 75,
        errors: [],
      });

      // Mock querySymbols
      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([]);

      await getSymbolsOverviewTool.execute({
        relativePath: "src",
        maxAnswerChars: 200000,
      });

      // Verify only non-gitignored files were indexed
      expect(IndexerAdapter.indexFiles).toHaveBeenCalledWith(process.cwd(), [
        "src/file1.ts",
        "src/file3.ts",
      ]);
    });

    it("should handle trailing slashes in directory path", async () => {
      // Mock file system stat to return directory
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      // Mock glob to return files
      vi.mocked(globSync).mockReturnValue(["src/tools/file.ts"]);

      // Mock indexFiles
      vi.mocked(IndexerAdapter.indexFiles).mockResolvedValue({
        success: true,
        totalFiles: 1,
        totalSymbols: 3,
        duration: 50,
        errors: [],
      });

      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([]);

      await getSymbolsOverviewTool.execute({
        relativePath: "src/tools/", // Note trailing slash
        maxAnswerChars: 200000,
      });

      // Verify glob was called with normalized path (no trailing slash)
      expect(globSync).toHaveBeenCalledWith(
        "src/tools/**/*.{ts,tsx,js,jsx,py,java,cpp,c,h,hpp,cs,rb,go,rs,php,swift,kt,scala,r,m,mm}",
        expect.any(Object),
      );
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(IndexerAdapter.getOrCreateIndex).mockReturnValue({} as any);
      vi.mocked(gitignoreUtils.createGitignoreFilter).mockResolvedValue(
        () => false,
      );
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);
    });

    it("should handle indexFiles failure", async () => {
      vi.mocked(globSync).mockReturnValue(["src/file.ts"]);

      // Mock indexFiles to return failure
      vi.mocked(IndexerAdapter.indexFiles).mockResolvedValue({
        success: false,
        totalFiles: 0,
        totalSymbols: 0,
        duration: 0,
        errors: [{ file: "src/file.ts", error: "Failed to parse file" }],
      });

      const result = await getSymbolsOverviewTool.execute({
        relativePath: "src",
        maxAnswerChars: 200000,
      });

      expect(result).toBe(
        JSON.stringify({
          error: "Failed to index files: Failed to parse file",
        }),
      );
    });

    it("should handle glob errors", async () => {
      // Mock glob to throw error
      vi.mocked(globSync).mockImplementation(() => {
        throw new Error("Glob pattern error");
      });

      const result = await getSymbolsOverviewTool.execute({
        relativePath: "src",
        maxAnswerChars: 200000,
      });

      expect(result).toBe(
        JSON.stringify({
          error: "Glob error: Glob pattern error",
        }),
      );
    });

    it("should handle output size limit", async () => {
      vi.mocked(globSync).mockReturnValue(["src/file.ts"]);

      vi.mocked(IndexerAdapter.indexFiles).mockResolvedValue({
        success: true,
        totalFiles: 1,
        totalSymbols: 3,
        duration: 50,
        errors: [],
      });

      // Mock querySymbols to return many symbols
      const manySymbols = Array(1000)
        .fill(null)
        .map((_, i) => ({
          name: `symbol${i}`,
          containerName: undefined,
          kind: SymbolKind.Function,
          location: {
            uri: "file:///test/src/file.ts",
            range: {
              start: { line: i, character: 0 },
              end: { line: i, character: 10 },
            },
          },
          detail: undefined,
          deprecated: false,
        }));

      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue(manySymbols);

      const result = await getSymbolsOverviewTool.execute({
        relativePath: "src",
        maxAnswerChars: 100, // Very small limit
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toMatch(/Output too long/);
    });
  });
});
