import { describe, it, expect } from "vitest";
import { spawn } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";
import { createAndInitializeLSPClient } from "@internal/lsp-client";
// SymbolKind is defined as a namespace in vscode-languageserver-types, not an enum

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper function to get SymbolKind name from numeric value
function getSymbolKindName(kind: number): string {
  const kindMap: Record<number, string> = {
    1: "File",
    2: "Module",
    3: "Namespace",
    4: "Package",
    5: "Class",
    6: "Method",
    7: "Property",
    8: "Field",
    9: "Constructor",
    10: "Enum",
    11: "Interface",
    12: "Function",
    13: "Variable",
    14: "Constant",
    15: "String",
    16: "Number",
    17: "Boolean",
    18: "Array",
    19: "Object",
    20: "Key",
    21: "Null",
    22: "EnumMember",
    23: "Struct",
    24: "Event",
    25: "Operator",
    26: "TypeParameter",
  };
  return kindMap[kind] || `Unknown(${kind})`;
}

describe("TypeScript LSP Symbol Kinds", () => {
  it("should check what symbol kinds TypeScript LSP returns for variables and constants", async () => {
    const projectRoot = path.join(__dirname, "../fixtures");
    const testFile = path.join(projectRoot, "variables-test.ts");

    // Start TypeScript LSP (use the actual JS file, not the shell script)
    const lspProcess = spawn(
      "node",
      [
        path.join(
          __dirname,
          "../../node_modules/typescript-language-server/lib/cli.mjs",
        ),
        "--stdio",
      ],
      { cwd: projectRoot },
    );

    // Initialize LSP client
    const lspClient = await createAndInitializeLSPClient(
      projectRoot,
      lspProcess,
      "typescript",
      undefined,
      undefined,
    );

    try {
      // First, open the document
      const fileUri = `file://${testFile}`;
      const fs = await import("fs/promises");
      const fileContent = await fs.readFile(testFile, "utf-8");

      console.log("Opening document with URI:", fileUri);
      console.log("File content length:", fileContent.length);

      await lspClient.openDocument(fileUri, fileContent, "typescript");

      // Wait a bit for the server to process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get document symbols
      console.log("Getting document symbols...");
      const symbols = await lspClient.getDocumentSymbols(fileUri);
      console.log("Received symbols:", JSON.stringify(symbols, null, 2));

      console.log("TypeScript LSP Document Symbols:");

      // Analyze symbol kinds
      const symbolKindCounts: Record<string, number> = {};
      const examplesByKind: Record<string, string[]> = {};

      function analyzeSymbol(symbol: any, containerName?: string) {
        const kindName = getSymbolKindName(symbol.kind);
        symbolKindCounts[kindName] = (symbolKindCounts[kindName] || 0) + 1;

        if (!examplesByKind[kindName]) {
          examplesByKind[kindName] = [];
        }
        if (examplesByKind[kindName].length < 3) {
          const fullName = containerName
            ? `${containerName}.${symbol.name}`
            : symbol.name;
          examplesByKind[kindName].push(fullName);
        }

        // Recursively analyze children
        if (symbol.children) {
          for (const child of symbol.children) {
            analyzeSymbol(child, symbol.name);
          }
        }
      }

      for (const symbol of symbols) {
        analyzeSymbol(symbol);
      }

      console.log("\nSymbol Kind Counts:");
      for (const [kind, count] of Object.entries(symbolKindCounts)) {
        console.log(`  ${kind}: ${count}`);
        if (examplesByKind[kind]) {
          console.log(`    Examples: ${examplesByKind[kind].join(", ")}`);
        }
      }

      // Check specific variables
      const findSymbol = (name: string) => {
        function search(symbols: any[], container?: string): any {
          for (const symbol of symbols) {
            if (symbol.name === name) {
              return { symbol, container };
            }
            if (symbol.children) {
              const found = search(symbol.children, symbol.name);
              if (found) return found;
            }
          }
          return null;
        }
        return search(symbols);
      };

      // Check how specific symbols are classified
      const checkList = [
        "myVariable", // let
        "oldStyleVar", // var
        "MY_CONSTANT", // const
        "exportedVariable", // export let
        "EXPORTED_CONSTANT", // export const
        "arrowFunction", // const arrow function
        "modulePrivateConst", // const
        "modulePrivateLet", // let
      ];

      console.log("\nSpecific Symbol Analysis:");
      for (const name of checkList) {
        const found = findSymbol(name);
        if (found) {
          const kindName = getSymbolKindName(found.symbol.kind);
          console.log(`  ${name}: ${kindName}`);
        } else {
          console.log(`  ${name}: NOT FOUND`);
        }
      }

      // Assertions
      expect(symbolKindCounts).toBeDefined();
      expect(Object.keys(symbolKindCounts).length).toBeGreaterThan(0);

      // TypeScript typically uses these kinds:
      // - Variable (13) for let/var/const at module level
      // - Function (12) for functions
      // - Class (5) for classes
      // - Interface (11) for interfaces
      // - Property (7) for object properties and class fields

      console.log(
        "\nExpected Variable kind (13) count:",
        symbolKindCounts["Variable"] || 0,
      );
      console.log(
        "Expected Constant kind (14) count:",
        symbolKindCounts["Constant"] || 0,
      );
    } finally {
      // Cleanup
      await lspClient.stop();
      lspProcess.kill();
    }
  }, 30000); // Increase timeout for LSP operations
});
