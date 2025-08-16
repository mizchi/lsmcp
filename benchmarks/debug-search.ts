#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { join, relative } from "node:path";
import { glob as gitawareGlob } from "gitaware-glob";
import { readFile } from "node:fs/promises";

async function main() {
  console.log("🔍 Debugging search_for_pattern performance\n");

  const rootPath = process.cwd();
  const path = "src/tools/finder";
  const pattern = /function/gm;

  // Step 1: Measure glob time
  console.log("1. Testing glob performance...");
  const globStart = performance.now();
  const files = [];
  const globPattern = join(path, "**/*.{js,jsx,ts,tsx}");

  for await (const file of gitawareGlob(globPattern, {
    cwd: rootPath,
    gitignore: true,
    onlyFiles: true,
  })) {
    files.push(file as string);
  }
  const globTime = performance.now() - globStart;
  console.log(`   Glob time: ${globTime.toFixed(2)}ms`);
  console.log(`   Files found: ${files.length}\n`);

  // Step 2: Measure file reading time
  console.log("2. Testing file reading performance...");
  const readStart = performance.now();
  let totalMatches = 0;

  for (const file of files.slice(0, 5)) {
    // Test first 5 files
    const filePath = join(rootPath, file);
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");

    for (const line of lines) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        totalMatches++;
      }
    }
  }

  const readTime = performance.now() - readStart;
  console.log(`   Read time (5 files): ${readTime.toFixed(2)}ms`);
  console.log(`   Matches found: ${totalMatches}\n`);

  // Step 3: Test gitaware-glob alone for all TS files
  console.log("3. Testing glob for all TypeScript files...");
  const allTsStart = performance.now();
  let tsFileCount = 0;

  for await (const file of gitawareGlob("**/*.ts", {
    cwd: rootPath,
    gitignore: true,
    onlyFiles: true,
  })) {
    tsFileCount++;
  }

  const allTsTime = performance.now() - allTsStart;
  console.log(`   Time: ${allTsTime.toFixed(2)}ms`);
  console.log(`   TypeScript files: ${tsFileCount}`);
}

main().catch(console.error);
