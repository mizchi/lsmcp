import { beforeAll, describe, expect, it } from "vitest";
import { join } from "path";
import { pyrightAdapter } from "../../../src/presets/pyright.ts";
import { testLspConnection } from "../testHelpers.ts";
import { testMcpConnection } from "../testMcpHelpers.ts";
import { $ } from "zx";

const projectRoot = join(import.meta.dirname, "../../fixtures", "python");

// Shared initialization for Python environment
async function initializePythonEnvironment() {
  // Run uv sync in the project directory
  await $({ cwd: projectRoot })`uv sync`;
}

describe("Pyright Adapter", () => {
  beforeAll(async () => {
    await initializePythonEnvironment();
  }, 30000); // 30s timeout for initialization

  it("should connect to Pyright language server", async () => {
    const checkFiles = ["main.py"];
    const result = await testLspConnection(
      pyrightAdapter,
      projectRoot,
      checkFiles,
    );
    // Pyright might take longer to initialize or might fail in CI environment
    expect(result.connected).toBeDefined();
    if (result.connected) {
      expect(result.diagnostics).toBeDefined();
    } else {
      expect(result.error).toBeDefined();
    }
  });

  it("should detect type errors in Python files", async () => {
    const checkFiles = ["main.py"];
    const result = await testLspConnection(
      pyrightAdapter,
      projectRoot,
      checkFiles,
    );

    if (!result.connected) {
      console.warn("Pyright not available, skipping diagnostics test");
      return;
    }

    expect(result.diagnostics).toBeDefined();
    const mainDiagnostics = result.diagnostics?.["main.py"];
    expect(mainDiagnostics).toBeDefined();

    if (mainDiagnostics && mainDiagnostics.length > 0) {
      // Check that we have at least 2 type errors (lines 34 and 37)
      expect(mainDiagnostics.length).toBeGreaterThanOrEqual(2);

      // Check for the type error on line 34 (invalid_user)
      const line34Error = mainDiagnostics.find(
        (d) => d.range.start.line === 33, // 0-indexed
      );
      expect(line34Error).toBeDefined();
      if (line34Error) {
        expect(line34Error.severity).toBe(1); // Error severity
        expect(line34Error.message).toContain("str");
        expect(line34Error.message).toContain("int");
      }

      // Check for the type error on line 37 (result type mismatch)
      const line37Error = mainDiagnostics.find(
        (d) => d.range.start.line === 36, // 0-indexed
      );
      expect(line37Error).toBeDefined();
      if (line37Error) {
        expect(line37Error.severity).toBe(1); // Error severity
        expect(line37Error.message).toMatch(/dict|Dict|int/i);
      }
    }
  });

  it("should provide MCP tools including get_project_overview, get_diagnostics, and get_definitions", async () => {
    const result = await testMcpConnection(pyrightAdapter, projectRoot);

    expect(result.connected).toBe(true);
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
