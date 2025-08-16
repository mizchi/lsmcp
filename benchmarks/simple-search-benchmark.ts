#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { createSearchForPatternTool } from "../src/tools/finder/fileSystemToolsFactory.ts";
import { createFastSearchForPatternTool } from "../src/tools/finder/fastSearchForPatternTool.ts";

async function main() {
  console.log("🚀 Quick Search Pattern Benchmark\n");

  // Test with a simple pattern in a small directory
  const pattern = "function";
  const path = "src/tools/finder";

  console.log(`Pattern: "${pattern}"`);
  console.log(`Path: ${path}\n`);

  // Original implementation
  const original = createSearchForPatternTool();
  console.log("Testing original implementation...");
  const originalStart = performance.now();
  const originalResult = await original.execute({
    substringPattern: pattern,
    relativePath: path,
    restrictSearchToCodeFiles: true,
    contextLinesBefore: 0,
    contextLinesAfter: 0,
  });
  const originalTime = performance.now() - originalStart;
  const originalMatches = Object.keys(JSON.parse(originalResult)).length;
  console.log(`  Time: ${originalTime.toFixed(2)}ms`);
  console.log(`  Files with matches: ${originalMatches}\n`);

  // Fast implementation
  const fast = createFastSearchForPatternTool();
  console.log("Testing fast implementation...");
  const fastStart = performance.now();
  const fastResult = await fast.execute({
    substringPattern: pattern,
    relativePath: path,
    restrictSearchToCodeFiles: true,
    contextLinesBefore: 0,
    contextLinesAfter: 0,
  });
  const fastTime = performance.now() - fastStart;
  const fastMatches = Object.keys(JSON.parse(fastResult)).length;
  console.log(`  Time: ${fastTime.toFixed(2)}ms`);
  console.log(`  Files with matches: ${fastMatches}\n`);

  // Results
  console.log("=".repeat(50));
  console.log("RESULTS:");
  console.log(`  Original:  ${originalTime.toFixed(2)}ms`);
  console.log(`  Fast: ${fastTime.toFixed(2)}ms`);
  const speedup = originalTime / fastTime;
  const improvement = ((originalTime - fastTime) / originalTime) * 100;
  console.log(
    `  ⚡ Speedup: ${speedup.toFixed(2)}x (${improvement.toFixed(1)}% faster)`,
  );
}

main().catch(console.error);
