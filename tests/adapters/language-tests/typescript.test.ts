import { describe, expect, it } from "vitest";
import { join } from "path";
import { typescriptAdapter } from "../../../src/adapters/typescript-language-server.ts";
import { testLspConnection } from "../testHelpers.ts";

describe("TypeScript Adapter", () => {
  it("should connect to TypeScript language server", async () => {
    const projectRoot = join(import.meta.dirname, "../fixtures", "typescript");
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
            "line": 10,
            "message": "Cannot redeclare block-scoped variable 'testUser'.",
            "severity": 1,
            "source": "typescript",
          },
          {
            "file": "index.ts",
            "line": 19,
            "message": "Cannot redeclare block-scoped variable 'invalidUser'.",
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
            "line": 26,
            "message": "Cannot redeclare block-scoped variable 'result'.",
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
            "line": 34,
            "message": "Cannot redeclare block-scoped variable 'testUser'.",
            "severity": 1,
            "source": "typescript",
          },
          {
            "file": "index.ts",
            "line": 41,
            "message": "Cannot redeclare block-scoped variable 'invalidUser'.",
            "severity": 1,
            "source": "typescript",
          },
          {
            "file": "index.ts",
            "line": 48,
            "message": "Cannot redeclare block-scoped variable 'invalidUser'.",
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
          {
            "file": "index.ts",
            "line": 55,
            "message": "Cannot redeclare block-scoped variable 'result'.",
            "severity": 1,
            "source": "typescript",
          },
        ],
      }
    `);
  });
});
