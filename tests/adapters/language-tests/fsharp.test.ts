import { describe, expect, it } from "vitest";
import { join } from "path";
import { fsharpAdapter } from "../../../src/adapters/fsharp.ts";
import { testLspConnection } from "../testHelpers.ts";

describe("F# Adapter", () => {
  it("should connect to F# language server", async () => {
    const projectRoot = join(import.meta.dirname, "../fixtures", "fsharp");
    const checkFiles = ["Program.fs"];
    const result = await testLspConnection(
      fsharpAdapter,
      projectRoot,
      checkFiles,
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "connected": true,
        "diagnostics": [
          {
            "file": "Program.fs",
            "line": 18,
            "message": "This expression was expected to have type
          'int'    
      but here has type
          's...",
            "severity": 1,
            "source": "F# Compiler",
          },
          {
            "file": "Program.fs",
            "line": 21,
            "message": "Type constraint mismatch. The type 
          'string'    
      is not compatible with type...",
            "severity": 1,
            "source": "F# Compiler",
          },
        ],
      }
    `);
    // TODO: F# LSP may require additional initialization or project loading for diagnostics
  }, 30000);
});
