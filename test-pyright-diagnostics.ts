#!/usr/bin/env node
/**
 * Test script to verify Pyright diagnostics functionality
 */

import { spawn } from "child_process";
import { existsSync, promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function testPyrightDiagnostics() {
  // Use the existing Python project example
  const projectDir = join(process.cwd(), "examples/python-project");
  console.log("Test directory:", projectDir);

  // Check if UV is installed
  try {
    const { execSync } = await import("child_process");
    execSync("which uv", { stdio: "ignore" });
    console.log("UV is installed");
  } catch {
    console.error("UV is not installed. Please install UV first: curl -LsSf https://astral.sh/uv/install.sh | sh");
    process.exit(1);
  }

  try {
    // Install dependencies using UV
    console.log("Installing dependencies with UV...");
    const { execSync } = await import("child_process");
    execSync("uv sync", { cwd: projectDir, stdio: "inherit" });
    console.log("Dependencies installed");

    // Start LSMCP with Pyright
    const transport = new StdioClientTransport({
      command: "pnpm",
      args: ["tsx", "src/cli/lsmcp.ts", "--preset", "pyright"],
      env: {
        ...process.env,
        DEBUG: "lsmcp:*",
      },
      workingDirectory: projectDir,
    });

    const client = new Client(
      {
        name: "pyright-test",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    console.log("Connecting to LSMCP server...");
    await client.connect(transport);
    console.log("Connected successfully");

    // Wait for server initialization
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Request diagnostics
    console.log("\nRequesting diagnostics for main.py...");
    const result = await client.request(
      {
        method: "mcp__lsmcp__get_diagnostics",
        params: {
          root: projectDir,
          filePath: "main.py",
          forceRefresh: true,
          timeout: 10000,
        },
      },
      {}
    );

    console.log("\n=== Diagnostics Result ===");
    if (result && result.content && result.content[0]) {
      console.log(result.content[0].text);
    } else {
      console.log("No diagnostics returned");
    }

    // Also try get_all_diagnostics
    console.log("\n=== All Diagnostics ===");
    const allResult = await client.request(
      {
        method: "mcp__lsmcp__get_all_diagnostics",
        params: {
          root: projectDir,
          pattern: "**/*.py",
          severityFilter: "all",
        },
      },
      {}
    );

    if (allResult && allResult.content && allResult.content[0]) {
      console.log(allResult.content[0].text);
    } else {
      console.log("No diagnostics returned");
    }

    await client.close();
    console.log("\nTest completed successfully");
  } catch (error) {
    console.error("Error during test:", error);
  }
}

// Run the test
testPyrightDiagnostics().catch(console.error);