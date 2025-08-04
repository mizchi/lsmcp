import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { replaceRegexTool } from "./regexEditTools.ts";

describe("regexEditTools", () => {
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `serenity-regex-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    testFile = join(testDir, "test.ts");
  });

  afterEach(async () => {
    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("replaceRegex", () => {
    it("should replace single occurrence", async () => {
      const content = `function oldName() {
  return "hello";
}

function anotherFunction() {
  return oldName();
}`;
      await fs.writeFile(testFile, content);

      const result = await replaceRegexTool.execute({
        root: testDir,
        relativePath: "test.ts",
        regex: "function oldName\\(\\)",
        repl: "function newName()",
        allowMultipleOccurrences: false,
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.filesChanged).toEqual(["test.ts"]);

      const newContent = await fs.readFile(testFile, "utf-8");
      expect(newContent).toContain("function newName()");
      expect(newContent).toContain("return oldName()"); // Should not replace in function call
    });

    it("should replace multiple occurrences when allowed", async () => {
      const content = `const value = "test";
const another = "test";
const third = "test";`;
      await fs.writeFile(testFile, content);

      const result = await replaceRegexTool.execute({
        root: testDir,
        relativePath: "test.ts",
        regex: '"test"',
        repl: '"replaced"',
        allowMultipleOccurrences: true,
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);

      const newContent = await fs.readFile(testFile, "utf-8");
      expect(newContent).not.toContain('"test"');
      expect(newContent.match(/"replaced"/g)).toHaveLength(3);
    });

    it("should handle regex with groups", async () => {
      const content = `function myFunc(arg1: string, arg2: number) {
  return arg1 + arg2;
}`;
      await fs.writeFile(testFile, content);

      const result = await replaceRegexTool.execute({
        root: testDir,
        relativePath: "test.ts",
        regex: "function (\\w+)\\((.*?)\\)",
        repl: "const $1 = ($2) =>",
        allowMultipleOccurrences: false,
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);

      const newContent = await fs.readFile(testFile, "utf-8");
      expect(newContent).toContain(
        "const myFunc = (arg1: string, arg2: number) =>",
      );
    });

    it("should handle multiline patterns with dotall", async () => {
      const content = `class MyClass {
  constructor() {
    this.value = 1;
    this.name = "test";
  }
}`;
      await fs.writeFile(testFile, content);

      const result = await replaceRegexTool.execute({
        root: testDir,
        relativePath: "test.ts",
        regex: "constructor\\(\\) \\{.*?\\}",
        repl: "constructor(value: number = 1) {\n    this.value = value;\n  }",
        allowMultipleOccurrences: false,
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);

      const newContent = await fs.readFile(testFile, "utf-8");
      expect(newContent).toContain("constructor(value: number = 1)");
      expect(newContent).not.toContain('this.name = "test"');
    });

    it("should error when multiple matches found without allowMultipleOccurrences", async () => {
      const content = `const a = 1;
const b = 1;`;
      await fs.writeFile(testFile, content);

      const result = await replaceRegexTool.execute({
        root: testDir,
        relativePath: "test.ts",
        regex: "= 1",
        repl: "= 2",
        allowMultipleOccurrences: false,
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain("Multiple occurrences found");
    });

    it("should error when no matches found", async () => {
      const content = `const a = 1;`;
      await fs.writeFile(testFile, content);

      const result = await replaceRegexTool.execute({
        root: testDir,
        relativePath: "test.ts",
        regex: "nonexistent",
        repl: "replacement",
        allowMultipleOccurrences: false,
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain("No matches found");
    });

    it("should handle file not found", async () => {
      const result = await replaceRegexTool.execute({
        root: testDir,
        relativePath: "nonexistent.ts",
        regex: "test",
        repl: "replacement",
        allowMultipleOccurrences: false,
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBeTruthy();
    });
  });
});

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("regexEditTools module", () => {
    it("exports replaceRegexTool", () => {
      expect(replaceRegexTool).toBeDefined();
      expect(replaceRegexTool.name).toBe("replace_regex");
    });
  });
}
