#!/usr/bin/env tsx
// Test MCP indexer adapter behavior

import { 
  getOrCreateIndex,
  indexFiles,
  updateIndexIncremental,
  getIndexStats
} from "./src/indexer/mcp/IndexerAdapter.ts";
import { initialize, getLSPClient } from "./src/lsp/lspClient.ts";
import { spawn } from "child_process";
import { resolveAdapterCommand } from "./src/adapters/utils.ts";

async function main() {
  const rootPath = process.cwd();
  
  console.log("=== Testing MCP Indexer Adapter ===");
  console.log("Root path:", rootPath);
  
  // Check if LSP client is already initialized
  let client = getLSPClient();
  console.log("Initial LSP client:", client ? "exists" : "null");
  
  if (!client) {
    console.log("Initializing LSP client...");
    
    // Start tsgo language server
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
    client = getLSPClient();
    console.log("LSP client after init:", client ? "initialized" : "still null");
  }
  
  // Try to create index
  console.log("\n=== Creating Index ===");
  const index = getOrCreateIndex(rootPath);
  console.log("Index created:", index ? "success" : "failed");
  
  if (!index) {
    console.error("Failed to create index - LSP client issue");
    process.exit(1);
  }
  
  // Index some files
  console.log("\n=== Indexing Files ===");
  const result = await indexFiles(rootPath, ["test-incremental-index.ts"], { concurrency: 1 });
  console.log("Index result:", result);
  
  // Get stats
  console.log("\n=== Index Stats ===");
  const stats = getIndexStats(rootPath);
  console.log("Stats:", stats);
  
  // Try incremental update
  console.log("\n=== Incremental Update ===");
  const updateResult = await updateIndexIncremental(rootPath);
  console.log("Update result:", updateResult);
  
  process.exit(0);
}

main().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});