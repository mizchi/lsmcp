#!/usr/bin/env tsx
// Simple test for incremental indexing

import { initialize, getLSPClient } from "./src/lsp/lspClient.ts";
import { getOrCreateIndex } from "./src/indexer/mcp/IndexerAdapter.ts";
import { spawn } from "child_process";
import { resolveAdapterCommand } from "./src/adapters/utils.ts";

async function main() {
  const rootPath = process.cwd();
  
  console.log("=== Testing Incremental Index ===");
  
  // Initialize LSP client
  let client = getLSPClient();
  if (!client) {
    console.log("Initializing LSP client...");
    const resolved = resolveAdapterCommand({
      id: "tsgo",
      name: "tsgo", 
      bin: "npx",
      args: ["-y", "tsgo", "--lsp", "--stdio"]
    } as any, rootPath);
    
    const lspProcess = spawn(resolved.command, resolved.args, {
      cwd: rootPath,
      env: process.env
    });
    
    await initialize(rootPath, lspProcess, "typescript");
    await new Promise(resolve => setTimeout(resolve, 1000));
    client = getLSPClient();
    console.log("LSP client initialized");
  }
  
  // Create index
  const index = getOrCreateIndex(rootPath);
  if (!index) {
    console.error("Failed to create index");
    process.exit(1);
  }
  
  console.log("\n=== First Run: Index test files ===");
  await index.indexFiles(["test-*.ts"], 5);
  let stats = index.getStats();
  console.log(`Indexed ${stats.totalFiles} files with ${stats.totalSymbols} symbols`);
  
  console.log("\n=== Second Run: Incremental update ===");
  try {
    const result = await index.updateIncremental();
    console.log(`Updated ${result.updated.length} files, removed ${result.removed.length} files`);
    if (result.errors.length > 0) {
      console.log("Errors:", result.errors);
    }
  } catch (error) {
    console.error("Error during incremental update:", error);
  }
  
  stats = index.getStats();
  console.log(`Final: ${stats.totalFiles} files with ${stats.totalSymbols} symbols`);
  
  process.exit(0);
}

main().catch(console.error);