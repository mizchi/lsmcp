import { describe, expect, it } from "vitest";
import { join } from "path";
import { fsharpAdapter } from "../../../src/adapters/fsharp.ts";
import { testLspConnection } from "../testHelpers.ts";

describe("F# Adapter", () => {
  it(
    "should connect to F# language server and detect type errors",
    async () => {
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

      // Should detect the type error on line 19 (string vs int)
      const line19Error = programErrors.find((d) => d.line === 19);
      expect(line19Error).toBeDefined();
      expect(line19Error?.severity).toBe(1); // Error severity
      expect(line19Error?.source).toBe("F# Compiler");

      // Should detect the type error on line 22 (string vs int)
      const line22Error = programErrors.find((d) => d.line === 22);
      expect(line22Error).toBeDefined();
      expect(line22Error?.severity).toBe(1); // Error severity
      expect(line22Error?.source).toBe("F# Compiler");
    },
    30000,
  );
});
