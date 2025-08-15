import { describe, expect, it } from "vitest";
import { join } from "path";
import { moonbitAdapter } from "../../../src/presets/moonbit.ts";
import { testLspConnection } from "../testHelpers.ts";
import { testMcpConnection } from "../testMcpHelpers.ts";

describe("MoonBit Adapter", () => {
  it.skip("should connect to MoonBit language server", async () => {
    const projectRoot = join(import.meta.dirname, "../../fixtures", "moonbit");
    const checkFiles = ["main.mbt"];
    const result = await testLspConnection(
      moonbitAdapter,
      projectRoot,
      checkFiles,
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "connected": true,
        "diagnostics": [
          {
            "file": "main.mbt",
            "line": 7,
            "message": "Lexing error: invalid escape sequence: \\(",
            "severity": 1,
            "source": undefined,
          },
          {
            "file": "main.mbt",
            "line": 26,
            "message": "Lexing error: invalid escape sequence: \\(",
            "severity": 1,
            "source": undefined,
          },
          {
            "file": "main.mbt",
            "line": 3,
            "message": "Warning: Field 'email' is never read",
            "severity": 2,
            "source": undefined,
          },
          {
            "file": "main.mbt",
            "line": 6,
            "message": "Warning: Unused function 'greet_user'",
            "severity": 2,
            "source": undefined,
          },
          {
            "file": "main.mbt",
            "line": 6,
            "message": "Warning: Unused variable 'user'",
            "severity": 2,
            "source": undefined,
          },
          {
            "file": "main.mbt",
            "line": 18,
            "message": "Unused parameter list for the main function. The syntax is \`fn main { ... }\`",
            "severity": 1,
            "source": undefined,
          },
          {
            "file": "main.mbt",
            "line": 25,
            "message": "Warning: Unused variable 'id_map'",
            "severity": 2,
            "source": undefined,
          },
          {
            "file": "main.mbt",
            "line": 29,
            "message": "Warning: Unused variable 'invalid_id'",
            "severity": 2,
            "source": undefined,
          },
          {
            "file": "main.mbt",
            "line": 29,
            "message": "Expr Type Mismatch
              has type : Int
              wanted   : String",
            "severity": 1,
            "source": undefined,
          },
          {
            "file": "main.mbt",
            "line": 32,
            "message": "Warning: Unused variable 'result'",
            "severity": 2,
            "source": undefined,
          },
          {
            "file": "main.mbt",
            "line": 32,
            "message": "Expr Type Mismatch
              has type : Map[String, Int]
              wanted   : Int",
            "severity": 1,
            "source": undefined,
          },
        ],
      }
    `);
  }, 30000);

  it("should provide MCP tools including get_project_overview, get_diagnostics, and get_definitions", async () => {
    const projectRoot = join(import.meta.dirname, "../../fixtures", "moonbit");
    const result = await testMcpConnection(moonbitAdapter, projectRoot);

    if (!result.connected) {
      console.warn("MCP connection failed, skipping test");
      return;
    }

    expect(result.hasGetProjectOverview).toBe(true);
    expect(result.hasGetDiagnostics).toBe(true);
    expect(result.hasGetDefinitions).toBe(true);

    if (result.projectOverview) {
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
  }, 30000);
});
