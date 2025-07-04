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
    expect(result.connected).toBe(true);
    // Deno now returns lint warnings for unused variables
    expect(result.diagnostics).toHaveLength(2);
  });

  it("should detect type errors in Deno files", async () => {
    const projectRoot = join(import.meta.dirname, "../fixtures", "deno");
    const checkFiles = ["main.ts"];
    const result = await testLspConnection(
      denoAdapter,
      projectRoot,
      checkFiles,
    );

    // main.tsには2つの型エラーがあるはず
    expect(result.connected).toBe(true);
    expect(result.diagnostics).toHaveLength(2);
  });
});
