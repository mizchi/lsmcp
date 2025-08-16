import { describe, it, expect } from "vitest";
import { performance } from "node:perf_hooks";
import { createSearchForPatternTool } from "../../../src/tools/highlevel/fileSystemToolsFactory.ts";

describe("search_for_pattern performance", () => {
  it("should complete search within reasonable time", async () => {
    const tool = createSearchForPatternTool();

    // Test with a common pattern in the codebase
    const start = performance.now();
    const result = await tool.execute({
      substringPattern: "function",
      relativePath: "src/tools",
      restrictSearchToCodeFiles: true,
      contextLinesBefore: 0,
      contextLinesAfter: 0,
      maxAnswerChars: 200000,
    });
    const elapsed = performance.now() - start;

    // Parse result
    expect(result).toBeTruthy();
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeUndefined();

    // Should find multiple matches
    const fileCount = Object.keys(parsed).length;
    expect(fileCount).toBeGreaterThan(0);

    // Performance assertion: should complete within 100ms
    // (previously took ~13000ms with gitaware-glob)
    expect(elapsed).toBeLessThan(100);
    console.log(
      `Search completed in ${elapsed.toFixed(2)}ms, found matches in ${fileCount} files`,
    );
  });

  it("should handle large directory searches efficiently", async () => {
    const tool = createSearchForPatternTool();

    // Test with broader search
    const start = performance.now();
    const result = await tool.execute({
      substringPattern: "import.*from",
      relativePath: "src",
      restrictSearchToCodeFiles: true,
      contextLinesBefore: 0,
      contextLinesAfter: 0,
      maxAnswerChars: 200000,
    });
    const elapsed = performance.now() - start;

    // Parse result
    expect(result).toBeTruthy();
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeUndefined();

    // Should find many matches
    const fileCount = Object.keys(parsed).length;
    expect(fileCount).toBeGreaterThan(10);

    // Performance assertion: even for large searches, should complete within 200ms
    expect(elapsed).toBeLessThan(200);
    console.log(
      `Large search completed in ${elapsed.toFixed(2)}ms, found matches in ${fileCount} files`,
    );
  });

  it("should handle context lines efficiently", async () => {
    const tool = createSearchForPatternTool();

    // Test with context lines
    const start = performance.now();
    const result = await tool.execute({
      substringPattern: "class",
      relativePath: "src/tools",
      restrictSearchToCodeFiles: true,
      contextLinesBefore: 2,
      contextLinesAfter: 2,
      maxAnswerChars: 200000,
    });
    const elapsed = performance.now() - start;

    // Parse result
    expect(result).toBeTruthy();
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeUndefined();

    // Performance assertion: context lines shouldn't significantly impact performance
    expect(elapsed).toBeLessThan(150);
    console.log(`Search with context completed in ${elapsed.toFixed(2)}ms`);
  });
});
