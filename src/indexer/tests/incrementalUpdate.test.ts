/**
 * Tests for incremental index updates
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SymbolIndex } from "../core/SymbolIndex.ts";
import { SymbolKind } from "vscode-languageserver-types";
import * as gitUtils from "../utils/gitUtils.ts";

// Mock git utilities
vi.mock("../utils/gitUtils.ts", () => ({
  getGitHash: vi.fn(),
  getModifiedFiles: vi.fn(),
  getFileGitHash: vi.fn(),
}));

describe("Incremental Index Updates", () => {
  let symbolIndex: SymbolIndex;
  let mockSymbolProvider: any;
  let mockFileSystem: any;
  let mockCache: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock providers
    mockSymbolProvider = {
      getDocumentSymbols: vi.fn().mockResolvedValue([]),
    };

    mockFileSystem = {
      readFile: vi.fn().mockResolvedValue("test content"),
      exists: vi.fn().mockResolvedValue(true),
      stat: vi.fn().mockResolvedValue({ mtime: new Date() }),
    };

    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      clear: vi.fn(),
    };

    // Create index
    symbolIndex = new SymbolIndex(
      "/test",
      mockSymbolProvider,
      mockFileSystem,
      mockCache,
    );
  });

  describe("updateIncremental", () => {
    it("should handle non-git repository", async () => {
      vi.mocked(gitUtils.getGitHash).mockReturnValue(null);

      const result = await symbolIndex.updateIncremental();

      expect(result.errors).toContain("Not a git repository");
      expect(result.updated).toHaveLength(0);
      expect(result.removed).toHaveLength(0);
    });

    it("should handle first-time indexing", async () => {
      vi.mocked(gitUtils.getGitHash).mockReturnValue("abc123");
      // No previous hash in stats

      const result = await symbolIndex.updateIncremental();

      expect(result.errors).toContain("No previous git hash found");
    });

    it("should update modified files", async () => {
      // Setup git mocks - set up the sequence correctly
      vi.mocked(gitUtils.getGitHash)
        .mockReturnValueOnce("abc123") // First call during indexFiles
        .mockReturnValue("def456"); // All subsequent calls

      vi.mocked(gitUtils.getModifiedFiles).mockReturnValue([
        "src/file1.ts",
        "src/file2.ts",
      ]);
      vi.mocked(gitUtils.getFileGitHash).mockReturnValue("file123");

      // Mock symbol provider to return symbols
      mockSymbolProvider.getDocumentSymbols.mockResolvedValue([
        {
          name: "UpdatedClass",
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
      ]);

      // Index initial files - this will set lastGitHash
      await symbolIndex.indexFiles(["src/file1.ts"]);

      // Run incremental update
      const result = await symbolIndex.updateIncremental();

      expect(result.updated).toContain("src/file1.ts");
      expect(result.updated).toContain("src/file2.ts");
      expect(result.removed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);

      // Check that git hash was updated
      expect(symbolIndex.getStats().lastGitHash).toBe("def456");
    });

    it("should handle deleted files", async () => {
      // Setup git mocks - set up the sequence correctly
      vi.mocked(gitUtils.getGitHash)
        .mockReturnValueOnce("abc123") // First call during indexFiles
        .mockReturnValue("def456"); // All subsequent calls

      vi.mocked(gitUtils.getModifiedFiles).mockReturnValue(["deleted.ts"]);
      mockFileSystem.exists.mockResolvedValue(false); // File doesn't exist

      // Index initial files - this will set lastGitHash
      await symbolIndex.indexFiles(["dummy.ts"]);

      const result = await symbolIndex.updateIncremental();

      expect(result.updated).toHaveLength(0);
      expect(result.removed).toContain("deleted.ts");
    });
  });

  describe("needsReindex", () => {
    it("should return true for unindexed files", async () => {
      const needsReindex = await symbolIndex.needsReindex("new-file.ts");
      expect(needsReindex).toBe(true);
    });

    it("should return true for modified files", async () => {
      // Index a file first
      mockSymbolProvider.getDocumentSymbols.mockResolvedValue([]);
      await symbolIndex.indexFile("test.ts");

      // Mock file system to return newer mtime
      mockFileSystem.stat.mockResolvedValue({
        mtime: new Date(Date.now() + 10000), // 10 seconds in future
      });

      const needsReindex = await symbolIndex.needsReindex("test.ts");
      expect(needsReindex).toBe(true);
    });

    it("should return false for unchanged files", async () => {
      // First index a file
      mockSymbolProvider.getDocumentSymbols.mockResolvedValue([]);

      // Mock current time for indexing
      const indexTime = Date.now();

      // Mock file system to return a past mtime (file was modified before indexing)
      const fileMtime = new Date(indexTime - 60000); // File was modified 1 minute before indexing
      mockFileSystem.stat.mockResolvedValue({
        mtime: fileMtime,
      });

      await symbolIndex.indexFile("test.ts");

      // Return the same mtime when checking if reindex is needed
      // The file mtime is still before the index time, so no reindex needed
      mockFileSystem.stat.mockResolvedValue({
        mtime: fileMtime,
      });

      // File hasn't changed since indexing
      const needsReindex = await symbolIndex.needsReindex("test.ts");
      expect(needsReindex).toBe(false);
    });
  });
});
