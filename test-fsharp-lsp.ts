#!/usr/bin/env tsx

import { spawn } from "child_process";
import { createAndInitializeLSPClient } from "@lsmcp/lsp-client";
import { fileURLToPath } from "url";
import * as fs from "fs/promises";
import * as path from "path";

async function testFSharpLSP() {
  const projectRoot = path.join(process.cwd(), "test-fsharp");
  
  console.log("Starting F# LSP server...");
  const lspProcess = spawn("fsautocomplete", [], {
    cwd: projectRoot,
    env: process.env,
  });

  try {
    const client = await createAndInitializeLSPClient(
      projectRoot,
      lspProcess,
      "fsharp",
      {
        AutomaticWorkspaceInit: true,
      }
    );

    // Read the test file
    const testFilePath = path.join(projectRoot, "test.fs");
    const content = await fs.readFile(testFilePath, "utf-8");
    const uri = `file://${testFilePath}`;

    console.log("Opening document...");
    client.openDocument(uri, content);

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("Getting document symbols...");
    const symbols = await client.getDocumentSymbols(uri);

    console.log("\n=== Document Symbols ===");
    console.log(JSON.stringify(symbols, null, 2));

    // Check positions
    console.log("\n=== Symbol Positions ===");
    for (const symbol of symbols) {
      const lines = content.split("\n");
      const startLine = symbol.range.start.line;
      const lineContent = lines[startLine] || "";
      
      console.log(`Symbol: ${symbol.name}`);
      console.log(`  Position: Line ${startLine + 1}, Col ${symbol.range.start.character + 1}`);
      console.log(`  Line content: "${lineContent.trim()}"`);
      console.log(`  Is comment?: ${lineContent.trim().startsWith("///")}`);
      console.log("");
    }

    client.closeDocument(uri);
    await client.shutdown();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

testFSharpLSP().catch(console.error);