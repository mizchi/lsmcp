import { describe, expect, it } from "vitest";
import { join } from "path";
import { moonbitAdapter } from "../../../src/adapters/moonbit.ts";
import { testLspConnection } from "../testHelpers.ts";

describe("MoonBit Adapter", () => {
  it("should connect to MoonBit language server", async () => {
    const projectRoot = join(import.meta.dirname, "../fixtures", "moonbit");
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
  });
});
