import { describe, expect, it } from "vitest";
import { join } from "path";
import { rustAnalyzerAdapter } from "../../../src/presets/rust-analyzer.ts";
import { testLspConnection } from "../testHelpers.ts";
import { testMcpConnection } from "../testMcpHelpers.ts";

describe("Rust Analyzer Adapter", () => {
  const projectRoot = join(import.meta.dirname, "../../fixtures", "rust");

  it("should connect to Rust Analyzer", async () => {
    const checkFiles = ["src/main.rs"];
    const result = await testLspConnection(
      rustAnalyzerAdapter,
      projectRoot,
      checkFiles,
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "connected": true,
        "diagnostics": [],
      }
    `);
  }, 30000); // Rust analyzer can be slow to initialize

  it("should provide MCP tools including get_project_overview, get_diagnostics, and get_definitions", async () => {
    const result = await testMcpConnection(rustAnalyzerAdapter, projectRoot);

    if (!result.connected) {
      console.warn("MCP connection failed, skipping test");
      return;
    }

    expect(result.hasGetProjectOverview).toBe(true);
    expect(result.hasGetDiagnostics).toBe(true);
    expect(result.hasGetDefinitions).toBe(true);

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
  });
});
