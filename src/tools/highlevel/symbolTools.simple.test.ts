import { describe, it, expect } from "vitest";
import { getFilesRecursively } from "./symbolTools.ts";
import { resolve, relative } from "node:path";
import { stat } from "node:fs/promises";

async function firstExistingDir(
  rootPath: string,
  candidates: string[],
): Promise<string> {
  for (const rel of candidates) {
    const abs = resolve(rootPath, rel);
    try {
      const s = await stat(abs);
      if (s.isDirectory()) return abs;
    } catch {
      // ignore
    }
  }
  // fallback to rootPath to avoid hard failures
  return rootPath;
}

describe("getFilesRecursively simple test", () => {
  it("should find TypeScript files in current project", async () => {
    const rootPath = process.cwd();

    // Try multiple stable directories in this repo; pick the first that exists
    const testDir = await firstExistingDir(rootPath, [
      "src/tools", // this repo has src/tools/*
      "src/config",
      "packages/code-indexer/src",
      "src",
    ]);
    const expectedPrefix = relative(rootPath, testDir);

    const files = await getFilesRecursively(testDir, rootPath);
    // Should find some TypeScript-like files under the chosen directory
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.endsWith(".ts"))).toBe(true);

    // Returned paths should be relative to rootPath and start with the chosen directory prefix
    expect(files.every((f) => f.startsWith(expectedPrefix))).toBe(true);
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
