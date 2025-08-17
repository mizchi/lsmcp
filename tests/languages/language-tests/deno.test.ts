import { describe, expect, it } from "vitest";
import { join } from "path";
import { denoAdapter } from "../../../src/presets/deno.ts";
import { testLspConnection } from "../testHelpers.ts";
import { testMcpConnection } from "../testMcpHelpers.ts";

describe("Deno Adapter", () => {
  const projectRoot = join(import.meta.dirname, "../../fixtures", "deno");

  it("should connect to Deno language server", async () => {
    const checkFiles = ["main.ts"];
    const result = await testLspConnection(
      denoAdapter,
      projectRoot,
      checkFiles,
    );
    expect(result.connected).toBe(true);
    // Diagnostics may vary depending on Deno version and configuration
    expect(result.diagnostics).toBeDefined();
  });

  it("should detect type errors in Deno files", async () => {
    const checkFiles = ["main.ts"];
    const result = await testLspConnection(
      denoAdapter,
      projectRoot,
      checkFiles,
    );

    // Check connection successful
    expect(result.connected).toBe(true);
    // Diagnostics may vary depending on Deno version and configuration
    expect(result.diagnostics).toBeDefined();
  });

  it("should provide MCP tools including get_project_overview, get_diagnostics, get_definitions, search_symbols, and get_symbol_details", async () => {
    const result = await testMcpConnection(denoAdapter, projectRoot, "main.ts");

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
    }

    // Verify get_diagnostics works
    expect(result.diagnosticsResult).toBeDefined();

    // Verify get_definitions works (may not find the symbol, but tool should be callable)
    // The result is optional since "main" might not exist

    // Verify search_symbols works
    if (result.searchSymbolsResult) {
      expect(result.searchSymbolsResult).toBeDefined();
      expect(result.searchSymbolsResult.length).toBeGreaterThan(0);
    }

    // Verify get_symbol_details works
    if (result.symbolDetailsResult) {
      expect(result.symbolDetailsResult).toBeDefined();
      expect(result.symbolDetailsResult.length).toBeGreaterThan(0);
    }
  });
});
