#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { join } from "node:path";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createSearchForPatternTool } from "../src/tools/highlevel/fileSystemToolsFactory.ts";
import { createFastSearchForPatternTool } from "../src/tools/highlevel/fastSearchForPatternTool.ts";

// Benchmark configurations
const WARMUP_RUNS = 2;
const TEST_RUNS = 5;
const TEST_PATTERNS = [
  { pattern: "function", description: "Common keyword" },
  { pattern: "async\\s+function", description: "Regex pattern" },
  { pattern: "import.*from", description: "Complex regex" },
  { pattern: "TODO|FIXME", description: "OR pattern" },
];

const TEST_PATHS = [
  { path: "src", description: "src directory" },
  { path: "src/tools", description: "Nested directory" },
];

interface BenchmarkResult {
  tool: string;
  pattern: string;
  path: string;
  runs: number[];
  average: number;
  median: number;
  min: number;
  max: number;
  filesFound: number;
  matchesFound: number;
}

async function runBenchmark(
  tool: any,
  pattern: string,
  relativePath: string,
  runs: number,
): Promise<{ times: number[]; filesFound: number; matchesFound: number }> {
  const times: number[] = [];
  let filesFound = 0;
  let matchesFound = 0;

  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const result = await tool.execute({
      substringPattern: pattern,
      relativePath,
      restrictSearchToCodeFiles: true,
      contextLinesBefore: 0,
      contextLinesAfter: 0,
    });
    const end = performance.now();
    times.push(end - start);

    // Count results
    if (i === 0) {
      try {
        const parsed = JSON.parse(result);
        if (!parsed.error) {
          filesFound = Object.keys(parsed).length;
          matchesFound = Object.values(parsed).reduce(
            (acc: number, matches: any) =>
              acc + (Array.isArray(matches) ? matches.length : 0),
            0,
          );
        }
      } catch {}
    }
  }

  return { times, filesFound, matchesFound };
}

function calculateStats(times: number[]) {
  const sorted = [...times].sort((a, b) => a - b);
  return {
    average: times.reduce((a, b) => a + b, 0) / times.length,
    median: sorted[Math.floor(sorted.length / 2)],
    min: Math.min(...times),
    max: Math.max(...times),
  };
}

async function main() {
  console.log("🚀 Starting search_for_pattern Performance Benchmark\n");
  console.log("=".repeat(80));

  const results: BenchmarkResult[] = [];

  // Create tools
  const originalTool = createSearchForPatternTool();
  const fastTool = createFastSearchForPatternTool();

  const tools = [
    { tool: originalTool, name: "Original" },
    { tool: fastTool, name: "Fast" },
  ];

  // Run benchmarks
  for (const { tool, name } of tools) {
    console.log(`\n📊 Testing ${name} Implementation`);
    console.log("-".repeat(40));

    for (const { pattern, description } of TEST_PATTERNS) {
      for (const { path, description: pathDesc } of TEST_PATHS) {
        process.stdout.write(`  ${description} in ${pathDesc}... `);

        // Warmup
        await runBenchmark(tool, pattern, path, WARMUP_RUNS);

        // Actual benchmark
        const { times, filesFound, matchesFound } = await runBenchmark(
          tool,
          pattern,
          path,
          TEST_RUNS,
        );

        const stats = calculateStats(times);
        results.push({
          tool: name,
          pattern: description,
          path: pathDesc,
          runs: times,
          ...stats,
          filesFound,
          matchesFound,
        });

        console.log(`✅ avg: ${stats.average.toFixed(2)}ms`);
      }
    }
  }

  // Display results
  console.log("\n" + "=".repeat(80));
  console.log("📈 BENCHMARK RESULTS");
  console.log("=".repeat(80));

  // Group by pattern and path for comparison
  for (const { pattern, description } of TEST_PATTERNS) {
    for (const { path, description: pathDesc } of TEST_PATHS) {
      console.log(`\n🔍 Pattern: "${description}" in ${pathDesc}`);
      console.log("-".repeat(60));

      const relevantResults = results.filter(
        (r) => r.pattern === description && r.path === pathDesc,
      );

      console.log(
        "Tool".padEnd(12) +
          "Avg (ms)".padEnd(12) +
          "Min (ms)".padEnd(12) +
          "Max (ms)".padEnd(12) +
          "Files".padEnd(10) +
          "Matches",
      );
      console.log("-".repeat(60));

      for (const result of relevantResults) {
        console.log(
          result.tool.padEnd(12) +
            result.average.toFixed(2).padEnd(12) +
            result.min.toFixed(2).padEnd(12) +
            result.max.toFixed(2).padEnd(12) +
            result.filesFound.toString().padEnd(10) +
            result.matchesFound,
        );
      }

      // Calculate speedup if we have both implementations
      if (relevantResults.length === 2) {
        const original = relevantResults[0];
        const fast = relevantResults[1];
        const speedup = original.average / fast.average;
        const improvement =
          ((original.average - fast.average) / original.average) * 100;

        console.log("-".repeat(60));
        console.log(
          `⚡ Speedup: ${speedup.toFixed(2)}x (${improvement.toFixed(1)}% faster)`,
        );
      }
    }
  }

  // Overall summary
  if (results.some((r) => r.tool === "Fast")) {
    console.log("\n" + "=".repeat(80));
    console.log("📊 OVERALL SUMMARY");
    console.log("=".repeat(80));

    const originalAvg =
      results
        .filter((r) => r.tool === "Original")
        .reduce((sum, r) => sum + r.average, 0) /
      results.filter((r) => r.tool === "Original").length;

    const fastAvg =
      results
        .filter((r) => r.tool === "Fast")
        .reduce((sum, r) => sum + r.average, 0) /
      results.filter((r) => r.tool === "Fast").length;

    const overallSpeedup = originalAvg / fastAvg;
    const overallImprovement = ((originalAvg - fastAvg) / originalAvg) * 100;

    console.log(`\n🎯 Average Performance:`);
    console.log(`  Original:  ${originalAvg.toFixed(2)}ms`);
    console.log(`  Fast: ${fastAvg.toFixed(2)}ms`);
    console.log(
      `  ⚡ Overall: ${overallSpeedup.toFixed(2)}x faster (${overallImprovement.toFixed(1)}% improvement)`,
    );
  }

  // Save detailed results to file
  const resultsDir = join(process.cwd(), "benchmarks", "results");
  await mkdir(resultsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultsFile = join(resultsDir, `search-pattern-${timestamp}.json`);

  await writeFile(
    resultsFile,
    JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2),
  );

  console.log(`\n💾 Detailed results saved to: ${resultsFile}`);
}

main().catch(console.error);
