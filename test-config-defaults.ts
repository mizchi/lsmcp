#!/usr/bin/env tsx
// Test config.json defaults loading

import { indexSymbolsTool } from "./src/mcp/tools/indexToolsUnified.ts";
import { initialize, getLSPClient } from "./src/lsp/lspClient.ts";
import { spawn } from "child_process";
import { resolveAdapterCommand } from "./src/adapters/utils.ts";
import { loadIndexConfig } from "./src/indexer/core/configLoader.ts";

async function testConfigDefaults() {
  const rootPath = process.cwd();
  
  console.log("=== Testing Config Defaults Loading ===\n");
  
  // Show current config
  const config = loadIndexConfig(rootPath);
  console.log("Loaded config from .lsmcp/config.json:");
  console.log("- Index files:", config?.indexFiles);
  console.log("- Concurrency:", config?.settings?.indexConcurrency);
  console.log("\n");
  
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
    await new Promise(resolve => setTimeout(resolve, 1000));
    client = getLSPClient();
    console.log("LSP client initialized\n");
  }
  
  // Test 1: Use defaults from config.json (no pattern specified)
  console.log("=== Test 1: Use Config Defaults (no pattern specified) ===");
  const result1 = await indexSymbolsTool.execute({
    root: rootPath,
    // pattern not specified - should use config.json
    // concurrency not specified - should use config.json
    noCache: false,
    forceReset: true
  });
  console.log(result1);
  console.log("\n");
  
  // Test 2: Override with custom pattern
  console.log("=== Test 2: Override with Custom Pattern ===");
  const result2 = await indexSymbolsTool.execute({
    pattern: "test-*.ts",  // Override pattern
    root: rootPath,
    concurrency: 2,  // Override concurrency
    noCache: true,
    forceReset: false
  });
  console.log(result2);
  console.log("\n");
  
  process.exit(0);
}

testConfigDefaults().catch(error => {
  console.error("Error:", error);
  process.exit(1);
});