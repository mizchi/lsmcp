import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSymbolsOverviewTool } from "./symbolTools.ts";
import * as IndexerAdapter from "../../indexer/mcp/IndexerAdapter.ts";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import { SymbolKind } from "vscode-languageserver-types";
import { glob } from "gitaware-glob";

// Mock modules
vi.mock("../../indexer/mcp/IndexerAdapter.ts", () => ({
  getOrCreateIndex: vi.fn(),
  indexFiles: vi.fn(),
  querySymbols: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  stat: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock("gitaware-glob", () => ({
  glob: vi.fn(),
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
    });

    it("should handle directory with TypeScript files", async () => {
      // Mock file system stat to return directory
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      // Mock glob to return files (now used instead of readdir)
      vi.mocked(glob).mockResolvedValue([
        "index.ts",
        "subdir/symbolTools.ts",
        "fileSystemTools.ts",
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
      vi.mocked(IndexerAdapter.querySymbols).mockImplementation((_, query) => {
        const file = query?.file;
        if (file === "src/serenity/tools/index.ts") {
          return [
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
          ];
        } else if (file === "src/serenity/tools/fileSystemTools.ts") {
          return [
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
          ];
        } else if (file === "src/serenity/tools/subdir/symbolTools.ts") {
          return [
            {
              name: "getSymbolsOverviewTool",
              containerName: undefined,
              kind: SymbolKind.Variable,
              location: {
                uri: "file:///test/src/serenity/tools/subdir/symbolTools.ts",
                range: {
                  start: { line: 0, character: 0 },
                  end: { line: 0, character: 10 },
                },
              },
              detail: undefined,
              deprecated: false,
            },
          ];
        }
        return [];
      });

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
        "src/serenity/tools/subdir/symbolTools.ts": [
          { name_path: "getSymbolsOverviewTool", kind: "variable" },
        ],
        "src/serenity/tools/fileSystemTools.ts": [
          { name_path: "readFileTool", kind: "variable" },
          { name_path: "writeFileTool", kind: "variable" },
        ],
      });

      // Verify glob was called
      expect(glob).toHaveBeenCalledWith(
        "**/*.{ts,tsx,js,jsx,py,java,cpp,c,h,hpp,cs,rb,go,rs,php,swift,kt,scala,r,m,mm,fs,fsx,ml,mli}",
        { cwd: expect.stringContaining("src/serenity/tools") },
      );

      // Verify indexFiles was called (order may vary)
      expect(IndexerAdapter.indexFiles).toHaveBeenCalled();
      const callArgs = vi.mocked(IndexerAdapter.indexFiles).mock.calls[0];
      expect(callArgs[0]).toBe(process.cwd());
      expect(callArgs[1].sort()).toEqual([
        "src/serenity/tools/fileSystemTools.ts",
        "src/serenity/tools/index.ts",
        "src/serenity/tools/subdir/symbolTools.ts",
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

      // Verify readdir was NOT called for single file
      expect(fs.readdir).not.toHaveBeenCalled();
    });

    it("should handle empty directory", async () => {
      // Mock file system stat to return directory
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      // Mock glob to return empty array
      vi.mocked(glob).mockResolvedValue([]);

      const result = await getSymbolsOverviewTool.execute({
        relativePath: "src/empty-dir",
        maxAnswerChars: 200000,
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe("No files found in src/empty-dir");

      // Verify indexFiles was NOT called with empty file list
      expect(IndexerAdapter.indexFiles).not.toHaveBeenCalled();
    });

    it("should filter out gitignored files", async () => {
      // Mock file system stat to return directory
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      // Mock glob to return files (gitaware-glob automatically filters gitignored files)
      vi.mocked(glob).mockResolvedValue([
        "file1.ts",
        "file3.ts",
        // file2.ts is not included (gitignored)
      ]);

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

    it("should handle nested directories", async () => {
      // Mock file system stat to return directory
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      // Mock glob to return nested structure
      vi.mocked(glob).mockResolvedValue(["dir1/nested.ts", "file.ts"]);

      // Mock indexFiles
      vi.mocked(IndexerAdapter.indexFiles).mockResolvedValue({
        success: true,
        totalFiles: 2,
        totalSymbols: 5,
        duration: 50,
        errors: [],
      });

      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([]);

      await getSymbolsOverviewTool.execute({
        relativePath: "src/tools",
        maxAnswerChars: 200000,
      });

      // Verify indexFiles was called with all found files (order may vary)
      expect(IndexerAdapter.indexFiles).toHaveBeenCalled();
      const callArgs = vi.mocked(IndexerAdapter.indexFiles).mock.calls[0];
      expect(callArgs[0]).toBe(process.cwd());
      expect(callArgs[1].sort()).toEqual([
        "src/tools/dir1/nested.ts",
        "src/tools/file.ts",
      ]);
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(IndexerAdapter.getOrCreateIndex).mockReturnValue({} as any);
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);
    });

    it("should handle indexFiles failure", async () => {
      // Mock glob to return a file
      vi.mocked(glob).mockResolvedValue(["file.ts"]);

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

    it("should handle readdir errors", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      // Mock glob to throw error
      vi.mocked(glob).mockRejectedValue(new Error("Permission denied"));

      const result = await getSymbolsOverviewTool.execute({
        relativePath: "src",
        maxAnswerChars: 200000,
      });

      expect(result).toBe(
        JSON.stringify({
          error: "Directory scan error: Permission denied",
        }),
      );
    });

    it("should handle output size limit", async () => {
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
      } as any);

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
        relativePath: "src/file.ts",
        maxAnswerChars: 100, // Very small limit
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toMatch(/Output too long/);
    });
  });
});
