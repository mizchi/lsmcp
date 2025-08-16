#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { createSearchForPatternTool } from "../src/tools/highlevel/fileSystemToolsFactory.ts";
import { createFastSearchForPatternTool } from "../src/tools/highlevel/fastSearchForPatternTool.ts";

async function main() {
  console.log("🚀 Fast Search Pattern Benchmark\n");

  // Test with different patterns and paths
  const tests = [
    { pattern: "function", path: "src/tools/finder" },
    { pattern: "import.*from", path: "src/tools" },
    { pattern: "async", path: "src" },
  ];

  for (const { pattern, path } of tests) {
    console.log(`\nPattern: "${pattern}" in ${path}`);
    console.log("=".repeat(50));

    // Original implementation
    const original = createSearchForPatternTool();
    console.log("Testing original (gitaware-glob) implementation...");
    const originalStart = performance.now();
    const originalResult = await original.execute({
      substringPattern: pattern,
      relativePath: path,
      restrictSearchToCodeFiles: true,
      contextLinesBefore: 0,
      contextLinesAfter: 0,
      maxAnswerChars: 200000,
    });
    const originalTime = performance.now() - originalStart;
    const originalMatches =
      originalResult.startsWith("{") && !JSON.parse(originalResult).error
        ? Object.keys(JSON.parse(originalResult)).length
        : 0;
    console.log(`  Time: ${originalTime.toFixed(2)}ms`);
    console.log(`  Files with matches: ${originalMatches}`);

    // Fast implementation
    const fast = createFastSearchForPatternTool();
    console.log("\nTesting fast (custom walker) implementation...");
    const fastStart = performance.now();
    const fastResult = await fast.execute({
      substringPattern: pattern,
      relativePath: path,
      restrictSearchToCodeFiles: true,
      contextLinesBefore: 0,
      contextLinesAfter: 0,
      maxAnswerChars: 200000,
    });
    const fastTime = performance.now() - fastStart;
    const fastMatches =
      fastResult.startsWith("{") && !JSON.parse(fastResult).error
        ? Object.keys(JSON.parse(fastResult)).length
        : 0;
    console.log(`  Time: ${fastTime.toFixed(2)}ms`);
    console.log(`  Files with matches: ${fastMatches}`);

    // Results
    const speedup = originalTime / fastTime;
    const improvement = ((originalTime - fastTime) / originalTime) * 100;
    console.log(
      `\n  ⚡ Speedup: ${speedup.toFixed(2)}x (${improvement.toFixed(1)}% faster)`,
    );
  }

  console.log("\n" + "=".repeat(50));
  console.log("✅ Benchmark complete!");
}

main().catch(console.error);
