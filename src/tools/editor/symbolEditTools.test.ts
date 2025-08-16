import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import * as symbolIndex from "@internal/code-indexer";
import {
  insertAfterSymbolTool,
  insertBeforeSymbolTool,
  replaceSymbolBodyTool,
} from "./symbolEditTools";

vi.mock("@internal/code-indexer");

describe("symbolEditTools", () => {
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `serenity-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    testFile = join(testDir, "test.ts");

    // Create test file
    const testContent = `class TestClass {
  method1() {
    return "hello";
  }

  method2() {
    return "world";
  }
}

function standalone() {
  return 42;
}`;
    await fs.writeFile(testFile, testContent);

    // Mock symbol index
    vi.mocked(symbolIndex.getSymbolIndex).mockReturnValue({
      fileIndex: new Map(),
      symbolIndex: new Map(),
      kindIndex: new Map(),
      containerIndex: new Map(),
      fileWatchers: new Map(),
      indexingQueue: new Set(),
      isIndexing: false,
      rootPath: testDir,
      client: null,
      stats: {
        totalFiles: 0,
        totalSymbols: 0,
        indexingTime: 0,
        lastUpdated: new Date(),
      },
      eventEmitter: new (require("events").EventEmitter)(),
    });
  });

  afterEach(async () => {
    // Clean up test directory
    rmSync(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe("replaceSymbolBody", () => {
    it("should replace a method body", async () => {
      // Mock querySymbols to return our test symbol
      vi.mocked(symbolIndex.querySymbolsFromIndex).mockReturnValue([
        {
          name: "TestClass",
          kind: 5, // Class
          location: {
            uri: `file://${testFile}`,
            range: {
              start: { line: 0, character: 0 },
              end: { line: 8, character: 1 },
            },
          },
          children: [
            {
              name: "method1",
              kind: 6, // Method
              location: {
                uri: `file://${testFile}`,
                range: {
                  start: { line: 1, character: 2 },
                  end: { line: 3, character: 3 },
                },
              },
              containerName: "TestClass",
            },
          ],
        },
        {
          name: "method1",
          kind: 6, // Method
          location: {
            uri: `file://${testFile}`,
            range: {
              start: { line: 1, character: 2 },
              end: { line: 3, character: 3 },
            },
          },
          containerName: "TestClass",
        },
      ]);

      const result = await replaceSymbolBodyTool.execute({
        root: testDir,
        namePath: "TestClass/method1",
        relativePath: "test.ts",
        body: `method1() {
    return "replaced";
  }`,
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.filesChanged).toEqual(["test.ts"]);

      const content = await fs.readFile(testFile, "utf-8");
      expect(content).toContain('return "replaced"');
      expect(content).not.toContain('return "hello"');
    });

    it("should handle symbol not found", async () => {
      vi.mocked(symbolIndex.querySymbolsFromIndex).mockReturnValue([]);

      const result = await replaceSymbolBodyTool.execute({
        root: testDir,
        namePath: "NonExistent/method",
        relativePath: "test.ts",
        body: "new body",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toContain(
        "Symbol 'NonExistent/method' not found",
      );
    });
  });

  describe("insertBeforeSymbol", () => {
    it("should insert content before a symbol", async () => {
      vi.mocked(symbolIndex.querySymbolsFromIndex).mockReturnValue([
        {
          name: "TestClass",
          kind: 5, // Class
          location: {
            uri: `file://${testFile}`,
            range: {
              start: { line: 0, character: 0 },
              end: { line: 8, character: 1 },
            },
          },
          children: [
            {
              name: "method2",
              kind: 6,
              location: {
                uri: `file://${testFile}`,
                range: {
                  start: { line: 5, character: 2 },
                  end: { line: 7, character: 3 },
                },
              },
              containerName: "TestClass",
            },
          ],
        },
        {
          name: "method2",
          kind: 6,
          location: {
            uri: `file://${testFile}`,
            range: {
              start: { line: 5, character: 2 },
              end: { line: 7, character: 3 },
            },
          },
          containerName: "TestClass",
        },
      ]);

      const result = await insertBeforeSymbolTool.execute({
        root: testDir,
        namePath: "TestClass/method2",
        relativePath: "test.ts",
        body: "  // This is a comment",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);

      const content = await fs.readFile(testFile, "utf-8");
      // Check that comment is inserted before method2
      const lines = content.split("\n");
      const method2Index = lines.findIndex((l) => l.includes("method2()"));
      expect(method2Index).toBeGreaterThan(0);
      expect(lines[method2Index - 1]).toContain("// This is a comment");
    });
  });

  describe("insertAfterSymbol", () => {
    it("should insert content after a symbol", async () => {
      vi.mocked(symbolIndex.querySymbolsFromIndex).mockReturnValue([
        {
          name: "TestClass",
          kind: 5, // Class
          location: {
            uri: `file://${testFile}`,
            range: {
              start: { line: 0, character: 0 },
              end: { line: 8, character: 1 },
            },
          },
          children: [
            {
              name: "method1",
              kind: 6,
              location: {
                uri: `file://${testFile}`,
                range: {
                  start: { line: 1, character: 2 },
                  end: { line: 3, character: 3 },
                },
              },
              containerName: "TestClass",
            },
          ],
        },
        {
          name: "method1",
          kind: 6,
          location: {
            uri: `file://${testFile}`,
            range: {
              start: { line: 1, character: 2 },
              end: { line: 3, character: 3 },
            },
          },
          containerName: "TestClass",
        },
      ]);

      const result = await insertAfterSymbolTool.execute({
        root: testDir,
        namePath: "TestClass/method1",
        relativePath: "test.ts",
        body: '\n  method1_5() {\n    return "new method";\n  }',
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);

      const content = await fs.readFile(testFile, "utf-8");
      expect(content).toContain("method1_5()");
      expect(content).toContain('"new method"');
    });
  });

  describe("error handling", () => {
    it("should handle file read errors", async () => {
      vi.mocked(symbolIndex.querySymbolsFromIndex).mockReturnValue([
        {
          name: "TestClass",
          kind: 5, // Class
          location: {
            uri: `file://${testFile}`,
            range: {
              start: { line: 0, character: 0 },
              end: { line: 8, character: 1 },
            },
          },
          children: [
            {
              name: "method1",
              kind: 6,
              location: {
                uri: `file://${testFile}`,
                range: {
                  start: { line: 1, character: 2 },
                  end: { line: 3, character: 3 },
                },
              },
              containerName: "TestClass",
            },
          ],
        },
        {
          name: "method1",
          kind: 6,
          location: {
            uri: `file://${testFile}`,
            range: {
              start: { line: 1, character: 2 },
              end: { line: 3, character: 3 },
            },
          },
          containerName: "TestClass",
        },
      ]);

      // Delete the file to cause read error
      try {
        await fs.unlink(testFile);
      } catch (error) {
        // File might not exist, which is fine for this test
      }

      const result = await replaceSymbolBodyTool.execute({
        root: testDir,
        namePath: "TestClass/method1",
        relativePath: "test.ts",
        body: "new body",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(false);
      expect(parsedResult.error).toBeTruthy();
    });
  });
});

describe("symbolEditTools module", () => {
  it("exports all tools", () => {
    expect(replaceSymbolBodyTool).toBeDefined();
    expect(insertBeforeSymbolTool).toBeDefined();
    expect(insertAfterSymbolTool).toBeDefined();
  });
});
