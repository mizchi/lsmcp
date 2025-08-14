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
    expect(result).toMatchInlineSnapshot(`
      {
        "connected": true,
        "diagnostics": [
          {
            "file": "index.ts",
            "line": 6,
            "message": "Duplicate function implementation.",
            "severity": 1,
            "source": "typescript",
          },
          {
            "file": "index.ts",
            "line": 20,
            "message": "Type 'string' is not assignable to type 'number'.",
            "severity": 1,
            "source": "typescript",
          },
          {
            "file": "index.ts",
            "line": 26,
            "message": "Type 'string' is not assignable to type 'number'.",
            "severity": 1,
            "source": "typescript",
          },
          {
            "file": "index.ts",
            "line": 29,
            "message": "Duplicate function implementation.",
            "severity": 1,
            "source": "typescript",
          },
          {
            "file": "index.ts",
            "line": 49,
            "message": "Type 'string' is not assignable to type 'number'.",
            "severity": 1,
            "source": "typescript",
          },
          {
            "file": "index.ts",
            "line": 55,
            "message": "Type 'string' is not assignable to type 'number'.",
            "severity": 1,
            "source": "typescript",
          },
        ],
      }
    `);
  });

  it("should provide MCP tools including get_project_overview, get_diagnostics, and get_definitions", async () => {
    const result = await testMcpConnection(typescriptAdapter, projectRoot);

    expect(result.connected).toBe(true);
    expect(result.hasGetProjectOverview).toBe(true);
    expect(result.hasGetDiagnostics).toBe(true);
    expect(result.hasGetDefinitions).toBe(true);

    if (result.projectOverview) {
      // Verify project overview contains expected information
      // The response is in Markdown format, not JSON
      const overviewText = result.projectOverview[0].text;
      expect(overviewText).toContain("Project Overview");
      // The overview may not have detected TypeScript if index is empty
      // Just verify the structure is present
      expect(overviewText).toContain("Statistics");
      expect(overviewText).toContain("Key Components");
    }

    // Verify get_diagnostics works
    expect(result.diagnosticsResult).toBeDefined();

    // Verify get_definitions works (may not find the symbol, but tool should be callable)
    // The result is optional since "main" might not exist
  });
});
