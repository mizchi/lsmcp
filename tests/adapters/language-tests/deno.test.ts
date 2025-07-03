import { describe, expect, it } from "vitest";
import { join } from "path";
import { denoAdapter } from "../../../src/adapters/deno.ts";
import { testLspConnection } from "../testHelpers.ts";

describe("Deno Adapter", () => {
  it("should connect to Deno language server", async () => {
    const projectRoot = join(import.meta.dirname, "../fixtures", "deno");
    const checkFiles = ["main.ts"];
    const result = await testLspConnection(
      denoAdapter,
      projectRoot,
      checkFiles,
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "connected": true,
        "diagnostics": [],
      }
    `);
  });
});
