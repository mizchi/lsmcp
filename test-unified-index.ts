#!/usr/bin/env tsx
// Test unified index_symbols tool

import { indexSymbolsTool } from "./src/mcp/tools/indexToolsUnified.ts";
import { initialize, getLSPClient } from "./src/lsp/lspClient.ts";
import { spawn } from "child_process";
import { resolveAdapterCommand } from "./src/adapters/utils.ts";

async function testUnifiedTool() {
  const rootPath = process.cwd();
  
  console.log("=== Testing Unified index_symbols Tool ===\n");
  
  // Initialize LSP client if needed
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
    
    // Wait for LSP to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    client = getLSPClient();
    console.log("LSP client initialized\n");
  }
  
  // Test 1: Initial indexing
  console.log("=== Test 1: Initial Indexing ===");
  const result1 = await indexSymbolsTool.execute({
    pattern: "test-*.ts",
    root: rootPath,
    concurrency: 5,
    noCache: false,
    forceReset: true  // Start fresh
  });
  console.log(result1);
  console.log("\n");
  
  // Test 2: Incremental update (should detect no changes)
  console.log("=== Test 2: Incremental Update (no changes) ===");
  const result2 = await indexSymbolsTool.execute({
    pattern: "test-*.ts",
    root: rootPath,
    concurrency: 5,
    noCache: false,
    forceReset: false
  });
  console.log(result2);
  console.log("\n");
  
  // Create a new test file
  console.log("=== Creating new test file ===");
  const fs = await import("fs/promises");
  await fs.writeFile("test-new-file.ts", `
export class NewTestClass {
  constructor(public name: string) {}
  
  greet(): string {
    return \`Hello, \${this.name}!\`;
  }
}

export function newTestFunction(): void {
  console.log("New test function");
}
`);
  console.log("Created test-new-file.ts\n");
  
  // Test 3: Incremental update (should detect new file)
  console.log("=== Test 3: Incremental Update (with new file) ===");
  const result3 = await indexSymbolsTool.execute({
    pattern: "test-*.ts",
    root: rootPath,
    concurrency: 5,
    noCache: false,
    forceReset: false
  });
  console.log(result3);
  console.log("\n");
  
  // Test 4: Force full re-index with noCache
  console.log("=== Test 4: Force Full Re-index ===");
  const result4 = await indexSymbolsTool.execute({
    pattern: "test-*.ts", 
    root: rootPath,
    concurrency: 5,
    noCache: true,  // Force full re-index
    forceReset: false
  });
  console.log(result4);
  console.log("\n");
  
  // Cleanup
  await fs.unlink("test-new-file.ts").catch(() => {});
  
  process.exit(0);
}

testUnifiedTool().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});