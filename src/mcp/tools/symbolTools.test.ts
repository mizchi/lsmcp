import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createGetSymbolsOverviewTool } from "./symbolToolsFactory.ts";
import * as IndexerAdapter from "../../indexer/mcp/IndexerAdapter.ts";
import { SymbolKind } from "vscode-languageserver-types";
import { createFsFromVolume, Volume } from "memfs";
import { MemFileSystemApi } from "../../core/io/MemFileSystemApi.ts";
import type { FileSystemApi } from "../../core/io/FileSystemApi.ts";

// Mock only IndexerAdapter, not file system modules
vi.mock("../../indexer/mcp/IndexerAdapter.ts", () => ({
  getOrCreateIndex: vi.fn(),
  indexFiles: vi.fn(),
  querySymbols: vi.fn(),
}));

describe("getSymbolsOverviewTool with memfs", () => {
  let vol: Volume;
  let fs: FileSystemApi;
  let getSymbolsOverviewTool: ReturnType<typeof createGetSymbolsOverviewTool>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Create fresh volume and fs for each test
    vol = new Volume();
    fs = new MemFileSystemApi(createFsFromVolume(vol));

    // Create tool with memfs
    getSymbolsOverviewTool = createGetSymbolsOverviewTool(fs);

    // Replace process.cwd to use our test directory
    vi.spyOn(process, "cwd").mockReturnValue("/test-project");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return error when path does not exist", async () => {
    const result = await getSymbolsOverviewTool.execute({
      relativePath: "non-existent-path",
      maxAnswerChars: 200000,
    });

    expect(result).toBe(
      JSON.stringify({ error: "Path not found: non-existent-path" }),
    );
  });

  it("should return error when index creation fails", async () => {
    await fs.mkdir("/test-project/test-path", { recursive: true });
    vi.mocked(IndexerAdapter.getOrCreateIndex).mockReturnValue(null);

    const result = await getSymbolsOverviewTool.execute({
      relativePath: "test-path",
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
      vi.mocked(IndexerAdapter.getOrCreateIndex).mockReturnValue({} as any);
    });

    it("should handle directory with TypeScript files", async () => {
      // Create directory structure
      await fs.mkdir("/test-project/src/serenity/tools/subdir", {
        recursive: true,
      });

      // Create files
      await fs.writeFile(
        "/test-project/src/serenity/tools/index.ts",
        "export function exportedFunction() {}",
        "utf-8",
      );
      await fs.writeFile(
        "/test-project/src/serenity/tools/fileSystemTools.ts",
        "export class FileSystem {}",
        "utf-8",
      );
      await fs.writeFile(
        "/test-project/src/serenity/tools/subdir/symbolTools.ts",
        "export interface SymbolInterface {}",
        "utf-8",
      );

      // Mock indexFiles to return success
      vi.mocked(IndexerAdapter.indexFiles).mockResolvedValue({
        success: true,
        totalFiles: 3,
        totalSymbols: 3,
        duration: 100,
        errors: [],
      });

      // Mock querySymbols to return different symbols for each file
      vi.mocked(IndexerAdapter.querySymbols).mockImplementation(
        (_index, { file }) => {
          if (file === "src/serenity/tools/index.ts") {
            return [
              {
                name: "exportedFunction",
                containerName: undefined,
                kind: SymbolKind.Function,
                location: {
                  uri: "file:///src/serenity/tools/index.ts",
                  range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 40 },
                  },
                },
              },
            ];
          }
          if (file === "src/serenity/tools/fileSystemTools.ts") {
            return [
              {
                name: "FileSystem",
                containerName: undefined,
                kind: SymbolKind.Class,
                location: {
                  uri: "file:///src/serenity/tools/fileSystemTools.ts",
                  range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 30 },
                  },
                },
              },
            ];
          }
          if (file === "src/serenity/tools/subdir/symbolTools.ts") {
            return [
              {
                name: "SymbolInterface",
                containerName: undefined,
                kind: SymbolKind.Interface,
                location: {
                  uri: "file:///src/serenity/tools/subdir/symbolTools.ts",
                  range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 35 },
                  },
                },
              },
            ];
          }
          return [];
        },
      );

      const result = await getSymbolsOverviewTool.execute({
        relativePath: "src/serenity/tools",
        maxAnswerChars: 200000,
      });

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("src/serenity/tools/index.ts");
      expect(parsed["src/serenity/tools/index.ts"]).toEqual([
        { name_path: "exportedFunction", kind: "function" },
      ]);
      expect(parsed["src/serenity/tools/fileSystemTools.ts"]).toEqual([
        { name_path: "FileSystem", kind: "class" },
      ]);
      expect(parsed["src/serenity/tools/subdir/symbolTools.ts"]).toEqual([
        { name_path: "SymbolInterface", kind: "interface" },
      ]);
    });

    it("should handle single file processing", async () => {
      // Create a single file
      await fs.mkdir("/test-project/project", { recursive: true });
      await fs.writeFile(
        "/test-project/project/types.ts",
        "export type MyType = string;",
        "utf-8",
      );

      // Mock indexFiles
      vi.mocked(IndexerAdapter.indexFiles).mockResolvedValue({
        success: true,
        totalFiles: 1,
        totalSymbols: 1,
        duration: 50,
        errors: [],
      });

      // Mock querySymbols
      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue([
        {
          name: "MyType",
          containerName: undefined,
          kind: SymbolKind.Variable, // Use Variable for type definitions
          location: {
            uri: "file:///project/types.ts",
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 30 },
            },
          },
        },
      ]);

      const result = await getSymbolsOverviewTool.execute({
        relativePath: "project/types.ts",
        maxAnswerChars: 200000,
      });

      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty("project/types.ts");
      expect(parsed["project/types.ts"]).toEqual([
        { name_path: "MyType", kind: "variable" },
      ]);
    });

    it("should handle maximum output limit", async () => {
      // Create file
      await fs.mkdir("/test-project/project", { recursive: true });
      await fs.writeFile(
        "/test-project/project/large.ts",
        "// Large file",
        "utf-8",
      );

      // Mock indexFiles
      vi.mocked(IndexerAdapter.indexFiles).mockResolvedValue({
        success: true,
        totalFiles: 1,
        totalSymbols: 100,
        duration: 200,
        errors: [],
      });

      // Create many symbols
      const manySymbols = Array.from({ length: 100 }, (_, i) => ({
        name: `Symbol${i}`,
        containerName: undefined,
        kind: SymbolKind.Variable,
        location: {
          uri: "file:///project/large.ts",
          range: {
            start: { line: i, character: 0 },
            end: { line: i, character: 20 },
          },
        },
      }));

      vi.mocked(IndexerAdapter.querySymbols).mockReturnValue(manySymbols);

      const result = await getSymbolsOverviewTool.execute({
        relativePath: "project/large.ts",
        maxAnswerChars: 100, // Very small limit
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult).toHaveProperty("error");
      expect(parsedResult.error).toContain("Output too long");
    });

    it("should handle empty directory", async () => {
      // Create empty directory
      await fs.mkdir("/test-project/empty", { recursive: true });

      // Mock indexFiles
      vi.mocked(IndexerAdapter.indexFiles).mockResolvedValue({
        success: true,
        totalFiles: 0,
        totalSymbols: 0,
        duration: 10,
        errors: [],
      });

      const result = await getSymbolsOverviewTool.execute({
        relativePath: "empty",
        maxAnswerChars: 200000,
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult).toHaveProperty("error");
      expect(parsedResult.error).toBe("No files found in empty");
    });

    it("should handle indexing errors", async () => {
      // Create directory with file
      await fs.mkdir("/test-project/project", { recursive: true });
      await fs.writeFile(
        "/test-project/project/error.ts",
        "// File with error",
        "utf-8",
      );

      // Mock indexFiles to return error
      vi.mocked(IndexerAdapter.indexFiles).mockResolvedValue({
        success: false,
        totalFiles: 1,
        totalSymbols: 0,
        duration: 50,
        errors: ["Failed to parse error.ts"],
      });

      const result = await getSymbolsOverviewTool.execute({
        relativePath: "project",
        maxAnswerChars: 200000,
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult).toHaveProperty("error");
      expect(parsedResult.error).toContain("Failed to index files:");
    });
  });
});
