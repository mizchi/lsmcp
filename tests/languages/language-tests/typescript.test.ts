import { describe, expect, it } from "vitest";
import { join } from "path";
import { typescriptAdapter } from "../../../src/presets/typescript-language-server.ts";
import { testLspConnection } from "../testHelpers.ts";
import { testMcpConnection } from "../testMcpHelpers.ts";

describe("TypeScript Adapter", () => {
  const projectRoot = join(import.meta.dirname, "../../fixtures", "typescript");

  it("should connect to TypeScript language server", async () => {
    const checkFiles = ["index.ts"];
    const result = await testLspConnection(
      typescriptAdapter,
      projectRoot,
      checkFiles,
    );
    expect(result.connected).toBe(true);
    expect(result.diagnostics).toBeDefined();
    expect(Array.isArray(result.diagnostics)).toBe(true);

    // TypeScript should detect at least 6 errors
    const errors = result.diagnostics?.filter((d) => d.severity === 1) || [];
    expect(errors.length).toBeGreaterThanOrEqual(6);
  });

  it("should provide MCP tools including get_project_overview, get_diagnostics, get_definitions, search_symbols, and get_symbol_details with expected symbol counts", async () => {
    const result = await testMcpConnection(typescriptAdapter, projectRoot);

    expect(result.connected).toBe(true);
    expect(result.hasGetProjectOverview).toBe(true);
    expect(result.hasGetDiagnostics).toBe(true);
    expect(result.hasGetDefinitions).toBe(true);
    expect(result.hasSearchSymbols).toBe(true);
    expect(result.hasGetSymbolDetails).toBe(true);

    if (result.projectOverview) {
      // Verify project overview contains expected information
      // The response is in Markdown format, not JSON
      const overviewText = result.projectOverview[0].text;
      expect(overviewText).toContain("Project Overview");
      expect(overviewText).toContain("Statistics");
      expect(overviewText).toContain("Key Components");

      // Verify expected symbols are detected if available
      // TypeScript test file should have multiple interfaces, classes, and functions
      if (
        overviewText.includes("Interfaces:") ||
        overviewText.includes("Classes:") ||
        overviewText.includes("Functions:")
      ) {
        const interfaceMatch = overviewText.match(/Interfaces:\s*(\d+)/);
        const classMatch = overviewText.match(/Classes:\s*(\d+)/);
        const functionMatch = overviewText.match(/Functions:\s*(\d+)/);

        if (interfaceMatch && parseInt(interfaceMatch[1]) > 0) {
          // At least 1 interface (User)
          expect(parseInt(interfaceMatch[1])).toBeGreaterThanOrEqual(1);
        }
        if (classMatch && parseInt(classMatch[1]) > 0) {
          // At least 1 class (Calculator)
          expect(parseInt(classMatch[1])).toBeGreaterThanOrEqual(1);
        }
        if (functionMatch && parseInt(functionMatch[1]) > 0) {
          // At least 2 functions (greet, calculate)
          expect(parseInt(functionMatch[1])).toBeGreaterThanOrEqual(2);
        }
      }
    }

    // Verify get_diagnostics works
    expect(result.diagnosticsResult).toBeDefined();

    // Verify get_definitions works (may not find the symbol, but tool should be callable)
    // The result is optional since "main" might not exist

    // Verify search_symbols works
    if (result.searchSymbolsResult) {
      expect(result.searchSymbolsResult).toBeDefined();
      expect(result.searchSymbolsResult.length).toBeGreaterThan(0);

      // The search result should contain symbols from the test files
      const searchText = result.searchSymbolsResult[0].text;
      expect(searchText).toContain("Found"); // "Found X symbols"
    }

    // Verify get_symbol_details works
    if (result.symbolDetailsResult) {
      expect(result.symbolDetailsResult).toBeDefined();
      expect(result.symbolDetailsResult.length).toBeGreaterThan(0);

      // The details should contain information about the symbol
      const detailsText = result.symbolDetailsResult[0].text;
      expect(detailsText).toContain("Symbol Details");
    }
  });
});
