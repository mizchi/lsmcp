#!/usr/bin/env tsx
// Demonstration of incremental index functionality

import { SymbolIndex } from "./src/indexer/core/SymbolIndex.ts";
import { LSPSymbolProvider } from "./src/indexer/lsp/LSPSymbolProvider.ts";
import { NodeFileSystemApi } from "./src/core/io/NodeFileSystemApi.ts";
import { MemoryCache } from "./src/indexer/cache/MemoryCache.ts";
import { resolve } from "path";

async function main() {
  const rootPath = process.cwd();
  const lspProvider = new LSPSymbolProvider(rootPath);
  const fileSystem = new NodeFileSystemApi();
  const cache = new MemoryCache();

  const index = new SymbolIndex(rootPath, lspProvider, fileSystem, cache);

  console.log("=== Initial Index ===");
  // Index only test files initially
  const testFiles = [
    "test-incremental-index.ts",
    "test-incremental-demo.ts"
  ];
  
  await index.indexFiles(testFiles, 5);
  console.log("Initial stats:", index.getStats());

  console.log("\n=== Query Symbols ===");
  const symbols = index.querySymbols({ name: "Test" });
  console.log(`Found ${symbols.length} symbols matching "Test":`);
  symbols.forEach(s => console.log(`  - ${s.name} (${s.kind})`));

  console.log("\n=== Incremental Update ===");
  const updateResult = await index.updateIncremental();
  console.log("Update result:", {
    updated: updateResult.updated.length,
    removed: updateResult.removed.length,
    errors: updateResult.errors.length
  });

  if (updateResult.updated.length > 0) {
    console.log("Updated files:", updateResult.updated.slice(0, 5));
  }
  if (updateResult.errors.length > 0) {
    console.log("Errors:", updateResult.errors);
  }

  console.log("\n=== Final Stats ===");
  console.log("Final stats:", index.getStats());

  // Cleanup
  await lspProvider.stop();
}

main().catch(console.error);