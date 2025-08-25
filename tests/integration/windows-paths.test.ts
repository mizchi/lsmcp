import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fileURLToPath, pathToFileURL } from "url";
import { resolve, join } from "path";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { platform } from "os";
import { uriToPath, pathToUri } from "../../src/utils/uriHelpers.ts";

describe("Windows Path Integration", () => {
  const isWindows = platform() === "win32";
  const testDir = resolve("test-windows-paths");
  const testFile = join(testDir, "test file with spaces.ts");

  beforeAll(() => {
    // Create test directory and file
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    writeFileSync(testFile, 'export const test = "hello world";');
  });

  afterAll(() => {
    // Clean up
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should handle round-trip conversion of paths with spaces", () => {
    const originalPath = testFile;
    const uri = pathToUri(originalPath);
    const convertedPath = uriToPath(uri);

    // Normalize for comparison (resolve makes absolute paths)
    expect(resolve(convertedPath)).toBe(resolve(originalPath));
  });

  it("should handle Windows drive letters correctly", () => {
    if (isWindows) {
      const testPaths = [
        "C:\\Program Files\\test.ts",
        "D:\\Projects\\my-app\\src\\index.ts",
        "E:\\Users\\John Doe\\Documents\\file.js",
      ];

      for (const path of testPaths) {
        const uri = pathToUri(path);
        expect(uri).toMatch(/^file:\/\/\/[A-Z]:/);

        // Convert back and check
        const converted = uriToPath(uri);
        expect(resolve(converted)).toBe(resolve(path));
      }
    }
  });

  it("should handle UNC paths on Windows", () => {
    if (isWindows) {
      // UNC paths are tricky, test the conversion logic
      const uncPath = "\\\\server\\share\\file.ts";

      // pathToFileURL should handle UNC paths
      const uri = pathToFileURL(uncPath).toString();
      expect(uri).toContain("file://");

      // And convert back
      const converted = fileURLToPath(uri);
      expect(converted).toBe(uncPath);
    }
  });

  it("should match Node.js built-in conversion", () => {
    const testPaths = isWindows
      ? ["C:\\test\\file.ts", "D:\\Program Files\\app.js"]
      : ["/home/user/file.ts", "/usr/local/bin/app"];

    for (const path of testPaths) {
      const ourUri = pathToUri(path);
      const nodeUri = pathToFileURL(path).toString();
      expect(ourUri).toBe(nodeUri);

      const ourPath = uriToPath(ourUri);
      const nodePath = fileURLToPath(ourUri);
      expect(ourPath).toBe(nodePath);
    }
  });
});
