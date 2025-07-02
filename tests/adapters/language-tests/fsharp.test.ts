import { describe, expect, it } from "vitest";
import { join } from "path";
import { fsacAdapter } from "../../../src/adapters/fsac.ts";
import { testLspConnection } from "../testHelpers.ts";

describe("F# Adapter", () => {
  it("should connect to F# language server", async () => {
    const projectRoot = join(import.meta.dirname, "../fixtures", "fsharp");
    const checkFiles = ["Program.fs"];
    const result = await testLspConnection(
      fsacAdapter,
      projectRoot,
      checkFiles,
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "connected": true,
        "diagnostics": [],
      }
    `);
    // TODO: F# LSP may require additional initialization or project loading for diagnostics
  }, 30000);
});
