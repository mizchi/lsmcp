import { describe, expect, it } from "vitest";
import { join } from "path";
import { fsharpAdapter } from "../../../src/adapters/fsharp.ts";
import { testLspConnection } from "../testHelpers.ts";

describe("F# Adapter", () => {
  it("should connect to F# language server and detect type errors", async () => {
    const projectRoot = join(import.meta.dirname, "../fixtures", "fsharp");
    const checkFiles = ["Program.fs"];
    const result = await testLspConnection(
      fsharpAdapter,
      projectRoot,
      checkFiles,
    );

    // Should successfully connect
    expect(result.connected).toBe(true);

    // Should have diagnostics array
    expect(result.diagnostics).toBeDefined();
    expect(Array.isArray(result.diagnostics)).toBe(true);

    // Should detect type errors in Program.fs
    const programErrors =
      result.diagnostics?.filter((d) => d.file === "Program.fs") || [];
    expect(programErrors.length).toBeGreaterThan(0);

    // Should detect the type error on line 18 (string vs int)
    const line18Error = programErrors.find((d) => d.line === 18);
    expect(line18Error).toBeDefined();
    expect(line18Error?.severity).toBe(1); // Error severity
    expect(line18Error?.source).toBe("F# Compiler");

    // Should detect the type error on line 21 (string vs int)
    const line21Error = programErrors.find((d) => d.line === 21);
    expect(line21Error).toBeDefined();
    expect(line21Error?.severity).toBe(1); // Error severity
    expect(line21Error?.source).toBe("F# Compiler");
  }, 30000);
});
