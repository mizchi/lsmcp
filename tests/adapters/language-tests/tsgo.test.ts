import { describe, expect, it } from "vitest";
import { join } from "path";
import { tsgoAdapter } from "../../../src/adapters/tsgo.ts";
import { testLspConnection } from "../testHelpers.ts";

describe("tsgo Adapter", () => {
  it("should connect to tsgo language server", async () => {
    const projectRoot = join(import.meta.dirname, "../fixtures", "typescript");
    const checkFiles = ["index.ts"];
    const result = await testLspConnection(
      tsgoAdapter,
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
            "source": "ts",
          },
          {
            "file": "index.ts",
            "line": 10,
            "message": "Cannot redeclare block-scoped variable 'testUser'.",
            "severity": 1,
            "source": "ts",
          },
          {
            "file": "index.ts",
            "line": 19,
            "message": "Cannot redeclare block-scoped variable 'invalidUser'.",
            "severity": 1,
            "source": "ts",
          },
          {
            "file": "index.ts",
            "line": 20,
            "message": "Type 'string' is not assignable to type 'number'.",
            "severity": 1,
            "source": "ts",
          },
          {
            "file": "index.ts",
            "line": 26,
            "message": "Type 'string' is not assignable to type 'number'.",
            "severity": 1,
            "source": "ts",
          },
          {
            "file": "index.ts",
            "line": 26,
            "message": "Cannot redeclare block-scoped variable 'result'.",
            "severity": 1,
            "source": "ts",
          },
          {
            "file": "index.ts",
            "line": 33,
            "message": "Duplicate function implementation.",
            "severity": 1,
            "source": "ts",
          },
          {
            "file": "index.ts",
            "line": 37,
            "message": "Cannot redeclare block-scoped variable 'testUser'.",
            "severity": 1,
            "source": "ts",
          },
          {
            "file": "index.ts",
            "line": 46,
            "message": "Cannot redeclare block-scoped variable 'invalidUser'.",
            "severity": 1,
            "source": "ts",
          },
          {
            "file": "index.ts",
            "line": 47,
            "message": "Type 'string' is not assignable to type 'number'.",
            "severity": 1,
            "source": "ts",
          },
          {
            "file": "index.ts",
            "line": 53,
            "message": "Type 'string' is not assignable to type 'number'.",
            "severity": 1,
            "source": "ts",
          },
          {
            "file": "index.ts",
            "line": 53,
            "message": "Cannot redeclare block-scoped variable 'result'.",
            "severity": 1,
            "source": "ts",
          },
        ],
      }
    `);
    // TODO: tsgo LSP may not publish diagnostics in the same way as typescript-language-server
  }, 10000);
});
