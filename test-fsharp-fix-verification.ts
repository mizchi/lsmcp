#!/usr/bin/env npx tsx

import { spawn } from "child_process";
import { createAndInitializeLSPClient } from "@lsmcp/lsp-client";
import { createLSPSymbolProvider } from "@lsmcp/lsp-client";
import { fileURLToPath } from "url";
import * as fs from "fs/promises";
import * as path from "path";

async function testFSharpPositionFix() {
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

    // Create symbol provider with F# language ID
    const fileContentProvider = async (uri: string): Promise<string> => {
      const filePath = fileURLToPath(uri);
      return await fs.readFile(filePath, "utf-8");
    };
    
    const symbolProvider = createLSPSymbolProvider(client, fileContentProvider, "fsharp");

    // Read the test file
    const testFilePath = path.join(projectRoot, "test.fs");
    const content = await fs.readFile(testFilePath, "utf-8");
    const uri = `file://${testFilePath}`;

    console.log("\n=== Getting symbols with F# position fix ===");
    const symbols = await symbolProvider.getDocumentSymbols(uri);

    console.log("\n=== Fixed Symbol Positions ===");
    const lines = content.split("\n");
    
    for (const symbol of symbols) {
      const startLine = symbol.range.start.line;
      const lineContent = lines[startLine] || "";
      
      console.log(`Symbol: ${symbol.name}`);
      console.log(`  Position: Line ${startLine + 1}, Col ${symbol.range.start.character + 1}`);
      console.log(`  Line content: "${lineContent.trim()}"`);
      console.log(`  Is comment?: ${lineContent.trim().startsWith("///")}`);
      
      // Check if the fix worked
      if (lineContent.trim().startsWith("///")) {
        console.log(`  ❌ STILL POINTING TO COMMENT!`);
      } else {
        console.log(`  ✅ Correctly pointing to code`);
      }
      console.log("");
    }

    // Summary
    const commentPositions = symbols.filter(s => {
      const line = lines[s.range.start.line] || "";
      return line.trim().startsWith("///");
    });

    console.log("=== Summary ===");
    console.log(`Total symbols: ${symbols.length}`);
    console.log(`Symbols still pointing to comments: ${commentPositions.length}`);
    
    if (commentPositions.length > 0) {
      console.log("\n❌ Position fix did not work for:");
      commentPositions.forEach(s => {
        console.log(`  - ${s.name}`);
      });
    } else {
      console.log("\n✅ All positions correctly fixed!");
    }

    process.exit(commentPositions.length > 0 ? 1 : 0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

testFSharpPositionFix().catch(console.error);