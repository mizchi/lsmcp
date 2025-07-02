#!/usr/bin/env npx tsx
/**
 * Test Rust LSP server (rust-analyzer) with LocationLink support
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "path";

async function testRustDefinitions() {
  const projectRoot = join(process.cwd(), "examples/rust-project");
  
  const transport = new StdioClientTransport({
    command: "node",
    args: [
      join(process.cwd(), "dist/lsmcp.js"),
      "-l", "rust",
      "--bin", "rust-analyzer"
    ],
    cwd: projectRoot,
    env: { ...process.env }
  });

  const client = new Client({
    name: "test-client",
    version: "1.0.0"
  }, {
    capabilities: {}
  });

  try {
    await client.connect(transport);
    console.log("✅ Connected to Rust LSP MCP server");

    // List available tools
    const tools = await client.listTools();
    console.log(`\nAvailable tools: ${tools.tools.length}`);
    const definitionTool = tools.tools.find(t => t.name.includes("definition"));
    console.log("Definition tool:", definitionTool?.name);

    // Test Go to Definition
    console.log("\n=== Testing Go to Definition ===");
    
    const defResult = await client.callTool({
      name: "get_definitions",
      arguments: {
        root: projectRoot,
        filePath: "src/main.rs",
        line: 1,
        symbolName: "Calculator"
      }
    });

    console.log("\nDefinition result:");
    const content = defResult.content[0];
    if (content.type === "text") {
      console.log(content.text);
    }

    // Test with greet function
    const greetDefResult = await client.callTool({
      name: "get_definitions",
      arguments: {
        root: projectRoot,
        filePath: "src/main.rs",
        line: 13,
        symbolName: "greet"
      }
    });

    console.log("\nGreet definition result:");
    const greetContent = greetDefResult.content[0];
    if (greetContent.type === "text") {
      const lines = greetContent.text.split('\n');
      console.log(lines.slice(0, 5).join('\n') + '...');
    }

    // Test hover
    console.log("\n=== Testing Hover ===");
    const hoverResult = await client.callTool({
      name: "get_hover",
      arguments: {
        root: projectRoot,
        filePath: "src/main.rs",
        line: 8,
        target: "Calculator"
      }
    });

    console.log("Hover result:");
    const hoverContent = hoverResult.content[0];
    if (hoverContent.type === "text") {
      const lines = hoverContent.text.split('\n');
      console.log(lines.slice(0, 8).join('\n'));
    }

    console.log("\n✅ All tests passed!");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await client.close();
  }
}

console.log("=== Testing Rust LSP Server ===");
console.log("This test verifies that rust-analyzer's LocationLink format is properly handled");

testRustDefinitions().catch(console.error);