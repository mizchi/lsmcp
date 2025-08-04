import { describe, it, expect } from "vitest";
import { getFilesRecursively } from "./symbolTools.ts";
import { createGitignoreFilter } from "../../core/io/gitignoreUtils.ts";
import { resolve } from "node:path";

describe("getFilesRecursively simple test", () => {
  it("should find TypeScript files in current project", async () => {
    const rootPath = process.cwd();
    const gitignoreFilter = await createGitignoreFilter(rootPath);

    // Test on a known directory in the project
    const testDir = resolve(rootPath, "src/core/pure");
    console.log("Testing directory:", testDir);
    console.log("Root path:", rootPath);

    const files = await getFilesRecursively(testDir, rootPath, gitignoreFilter);
    console.log("Found files:", files);

    // Should find some TypeScript files
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.endsWith(".ts"))).toBe(true);

    // Should have correct relative paths
    expect(files.every((f) => f.startsWith("src/core/pure"))).toBe(true);
  });

  it("should handle path replacement correctly", async () => {
    const rootPath = "/test/root";
    const testPath = "/test/root/src/file.ts";

    // Test the path replacement logic
    const relativePath = testPath.replace(rootPath + "/", "");
    expect(relativePath).toBe("src/file.ts");

    // Edge case: without trailing slash
    const relativePath2 = testPath.replace(rootPath, "");
    expect(relativePath2).toBe("/src/file.ts"); // This shows the issue!
  });
});
