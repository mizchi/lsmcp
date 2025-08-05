import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listDirTool } from "./fileSystemTools.ts";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as gitignoreUtils from "../../core/io/gitignoreUtils.ts";

vi.mock("node:fs/promises");
vi.mock("node:fs");
vi.mock("../../core/io/gitignoreUtils.ts");

describe("fileSystemTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, "cwd").mockReturnValue("/project");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("listDirTool", () => {
    it("should list files and directories correctly", async () => {
      // Mock file system
      vi.mocked(fsSync.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdir).mockResolvedValue([
        "README.md",
        "package.json",
        ".gitignore",
        "src",
        "node_modules",
        ".git",
        "dist",
      ] as any);

      // Mock stat to identify directories vs files
      vi.mocked(fs.stat).mockImplementation(async (path: any) => {
        const name = path.split("/").pop();
        const isDirectory = ["src", "node_modules", ".git", "dist"].includes(
          name,
        );
        return {
          isDirectory: () => isDirectory,
          isFile: () => !isDirectory,
        } as any;
      });

      // Mock gitignore filter - should return true for non-ignored files
      const mockFilter = vi.fn((path: string, _isDirectory?: boolean) => {
        // These should be ignored
        if (path === "node_modules" || path === ".git" || path === "dist") {
          return false;
        }
        // Everything else should be included
        return true;
      });
      vi.spyOn(gitignoreUtils, "createGitignoreFilter").mockReturnValue(
        mockFilter,
      );

      const result = await listDirTool.execute({
        relativePath: ".",
        recursive: false,
        maxAnswerChars: 200000,
      });

      const parsed = JSON.parse(result);

      // Verify that non-ignored files and directories are included
      expect(parsed.directories).toContain("src");
      expect(parsed.files).toContain("README.md");
      expect(parsed.files).toContain("package.json");
      expect(parsed.files).toContain(".gitignore");

      // Verify that ignored directories are NOT included
      expect(parsed.directories).not.toContain("node_modules");
      expect(parsed.directories).not.toContain(".git");
      expect(parsed.directories).not.toContain("dist");
    });

    it("should handle gitignore filter returning correct values", async () => {
      // This test simulates what might be happening in the bug
      vi.mocked(fsSync.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdir).mockResolvedValue([
        "README.md",
        "src",
        ".git",
        "dist",
      ] as any);

      vi.mocked(fs.stat).mockImplementation(async (path: any) => {
        const name = path.split("/").pop();
        const isDirectory = ["src", ".git", "dist"].includes(name);
        return {
          isDirectory: () => isDirectory,
          isFile: () => !isDirectory,
        } as any;
      });

      // Mock filter that returns correct values
      const correctFilter = vi.fn((path: string, _isDirectory?: boolean) => {
        // Returns false for ignored files (they should NOT be included)
        if (path === ".git" || path === "dist") {
          return false;
        }
        // Returns true for non-ignored files (they should be included)
        return true;
      });
      vi.spyOn(gitignoreUtils, "createGitignoreFilter").mockReturnValue(
        correctFilter,
      );

      const result = await listDirTool.execute({
        relativePath: ".",
        recursive: false,
        maxAnswerChars: 200000,
      });

      const parsed = JSON.parse(result);

      // With current implementation, if filter is buggy:
      // - If filter returns false, file is skipped (continue)
      // - If filter returns true, file is included

      // So with buggy filter:
      // - .git and dist return true, so they are NOT skipped
      // - README.md and src return false, so they ARE skipped

      console.log("Buggy filter result:", parsed);

      // With correct filter: only non-ignored items are shown
      expect(parsed.directories).not.toContain(".git");
      expect(parsed.directories).not.toContain("dist");
      expect(parsed.directories).toContain("src");
      expect(parsed.files).toContain("README.md");
    });

    it("should handle recursive directory listing", async () => {
      vi.mocked(fsSync.existsSync).mockReturnValue(true);

      // Mock readdir for different directories
      vi.mocked(fs.readdir).mockImplementation(async (path: any) => {
        if (path === "/project") {
          return ["src", "README.md"] as any;
        } else if (path === "/project/src") {
          return ["index.ts", "utils"] as any;
        } else if (path === "/project/src/utils") {
          return ["helper.ts"] as any;
        }
        return [] as any;
      });

      // Mock stat
      vi.mocked(fs.stat).mockImplementation(async (path: any) => {
        const name = path.split("/").pop();
        const isDirectory = ["src", "utils"].includes(name);
        return {
          isDirectory: () => isDirectory,
          isFile: () => !isDirectory,
        } as any;
      });

      // Mock gitignore filter - include everything
      const mockFilter = vi.fn((_path: string, _isDirectory?: boolean) => true);
      vi.spyOn(gitignoreUtils, "createGitignoreFilter").mockReturnValue(
        mockFilter,
      );

      const result = await listDirTool.execute({
        relativePath: ".",
        recursive: true,
        maxAnswerChars: 200000,
      });

      const parsed = JSON.parse(result);

      expect(parsed.directories).toContain("src");
      expect(parsed.directories).toContain("src/utils");
      expect(parsed.files).toContain("README.md");
      expect(parsed.files).toContain("src/index.ts");
      expect(parsed.files).toContain("src/utils/helper.ts");
    });

    it("should handle non-existent directory", async () => {
      vi.mocked(fsSync.existsSync).mockReturnValue(false);

      const result = await listDirTool.execute({
        relativePath: "non-existent",
        recursive: false,
        maxAnswerChars: 200000,
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe("Directory not found: non-existent");
    });
  });

  describe("listDirTool with real gitignore", () => {
    it("should test actual gitignore behavior", async () => {
      // Mock file system for the test
      vi.mocked(fsSync.existsSync).mockImplementation((path: any) => {
        if (path === "/project" || path === "/project/.gitignore") {
          return true;
        }
        return false;
      });

      vi.mocked(fs.readdir).mockResolvedValue([
        "README.md",
        "package.json",
        ".gitignore",
        "src",
        "node_modules",
        ".git",
        "dist",
        ".serena",
      ] as any);

      vi.mocked(fs.stat).mockImplementation(async (path: any) => {
        const name = path.split("/").pop();
        const isDirectory = [
          "src",
          "node_modules",
          ".git",
          "dist",
          ".serena",
        ].includes(name);
        return {
          isDirectory: () => isDirectory,
          isFile: () => !isDirectory,
        } as any;
      });

      // Create a real GitignoreManager instance with mocked fs
      const { GitignoreManager } = await import(
        "../../core/io/gitignoreUtils.ts"
      );
      const mockGitignoreContent = `node_modules/\n.git\ndist\n.serena\n*.log`;

      const mockFsForGitignore = {
        existsSync: (path: string) => path.endsWith(".gitignore"),
        readFileSync: () => mockGitignoreContent,
      };

      // Test the GitignoreManager directly
      const manager = new GitignoreManager(
        "/project",
        mockFsForGitignore as any,
      );

      console.log("Testing GitignoreManager.isIgnored:");
      console.log("  .git:", manager.isIgnored(".git"));
      console.log("  dist:", manager.isIgnored("dist"));
      console.log("  .serena:", manager.isIgnored(".serena"));
      console.log("  node_modules:", manager.isIgnored("node_modules"));
      console.log("  src:", manager.isIgnored("src"));
      console.log("  README.md:", manager.isIgnored("README.md"));

      // Test createGitignoreFilter
      const createFilter = (_rootPath: string) => {
        return (filePath: string) => !manager.isIgnored(filePath);
      };

      const filter = createFilter("/project");
      console.log("\nTesting filter (should return true for non-ignored):");
      console.log("  .git:", filter(".git"));
      console.log("  dist:", filter("dist"));
      console.log("  src:", filter("src"));
      console.log("  README.md:", filter("README.md"));
    });

    it("should test ignore package behavior with trailing slashes", async () => {
      const ignore = (await import("ignore")).default;
      const ig = ignore();

      // Test with node_modules/ (with trailing slash)
      ig.add(["node_modules/"]);

      console.log("\n=== Testing ignore package with trailing slash ===");
      console.log("Pattern: node_modules/");
      console.log("  'node_modules':", ig.ignores("node_modules"));
      console.log("  'node_modules/':", ig.ignores("node_modules/"));
      console.log("  'node_modules/foo':", ig.ignores("node_modules/foo"));

      // Test without trailing slash
      const ig2 = ignore();
      ig2.add(["node_modules"]);

      console.log("\nPattern: node_modules (no slash)");
      console.log("  'node_modules':", ig2.ignores("node_modules"));
      console.log("  'node_modules/':", ig2.ignores("node_modules/"));
      console.log("  'node_modules/foo':", ig2.ignores("node_modules/foo"));
    });

    it("should debug GitignoreManager loading", async () => {
      // Reset mocks
      vi.clearAllMocks();
      vi.unmock("../../core/io/gitignoreUtils.ts");

      // Import the real implementation
      const { GitignoreManager } = await import(
        "../../core/io/gitignoreUtils.ts"
      );

      // Mock fs with debug logging
      const mockGitignoreContent = `node_modules/\n.git\ndist\n.serena`;
      const mockFsDebug = {
        existsSync: (path: string) => {
          const exists = path === "/project/.gitignore";
          console.log(`[Debug] existsSync(${path}) = ${exists}`);
          return exists;
        },
        readFileSync: (path: string) => {
          console.log(`[Debug] readFileSync(${path})`);
          if (path === "/project/.gitignore") {
            console.log(
              `[Debug] Returning gitignore content:`,
              mockGitignoreContent,
            );
            return mockGitignoreContent;
          }
          throw new Error("File not found");
        },
      };

      console.log("\n=== Creating GitignoreManager ===");
      const manager = new GitignoreManager("/project", mockFsDebug as any);

      console.log("\n=== Testing isIgnored directly ===");
      const testPaths = [".git", "dist", "src", "README.md"];
      for (const path of testPaths) {
        const result = manager.isIgnored(path);
        console.log(`  ${path}: ${result}`);
      }

      console.log("\n=== Testing loaded rules ===");
      const rules = manager.getLoadedRules();
      console.log("Loaded rules:", rules);
    });

    it("should test with actual createGitignoreFilter", async () => {
      // Reset mocks
      vi.clearAllMocks();
      vi.unmock("../../core/io/gitignoreUtils.ts");

      // Import the real implementation
      const gitignoreUtils = await import("../../core/io/gitignoreUtils.ts");

      // Mock fs for GitignoreManager
      const mockGitignoreContent = `node_modules/\n.git\ndist\n.serena\n*.log`;
      const mockFsForGitignore = {
        existsSync: (path: string) => {
          console.log("[mockFs] existsSync called with:", path);
          return path === "/project/.gitignore";
        },
        readFileSync: (path: string) => {
          console.log("[mockFs] readFileSync called with:", path);
          if (path === "/project/.gitignore") {
            return mockGitignoreContent;
          }
          throw new Error("File not found");
        },
      };

      // Create filter with mocked fs
      const filter = gitignoreUtils.createGitignoreFilter(
        "/project",
        mockFsForGitignore as any,
      );

      console.log("\nTesting real createGitignoreFilter:");
      console.log("  .git (should be false):", filter(".git", true));
      console.log("  dist (should be false):", filter("dist", true));
      console.log("  .serena (should be false):", filter(".serena", true));
      console.log(
        "  node_modules (should be false):",
        filter("node_modules", true),
      );
      console.log("  src (should be true):", filter("src", true));
      console.log("  README.md (should be true):", filter("README.md", false));

      // These assertions show what SHOULD happen
      expect(filter(".git", true)).toBe(false);
      expect(filter("dist", true)).toBe(false);
      expect(filter(".serena", true)).toBe(false);
      expect(filter("node_modules", true)).toBe(false);
      expect(filter("src", true)).toBe(true);
      expect(filter("README.md", false)).toBe(true);
    });
  });
});
