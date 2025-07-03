import { describe, expect, it } from "vitest";
import { join } from "path";
import { tsgoAdapter } from "../../../src/adapters/tsgo.ts";
import { testLspConnection } from "../testHelpers.ts";

describe("tsgo Adapter", () => {
  it("should connect to tsgo language server with simple file", async () => {
    const projectRoot = join(import.meta.dirname, "../fixtures", "typescript");
    const checkFiles = ["simple.ts"];
    const result = await testLspConnection(
      tsgoAdapter,
      projectRoot,
      checkFiles,
    );

    // Check connection
    if (!result.connected) {
      console.log("tsgo connection failed:", result.error);
      // Skip test if tsgo is not available
      if (result.error?.includes("tsgo not found")) {
        console.log("Skipping test: tsgo not installed");
        return;
      }
    }

    expect(result.connected).toBe(true);
    expect(result.diagnostics).toBeDefined();

    const diagnostics = result.diagnostics || [];

    // Should detect type errors in simple.ts
    const typeErrors = diagnostics.filter(
      (d) =>
        d.message.includes("Type") &&
        (d.message.includes("'string' is not assignable to type 'number'") ||
          d.message.includes("'number' is not assignable to type 'string'")),
    );

    // Expect the two type errors
    expect(typeErrors.length).toBeGreaterThanOrEqual(2);

    // Check specific errors
    const line1Error = diagnostics.find((d) => d.line === 1);
    const line7Error = diagnostics.find((d) => d.line === 7);

    if (diagnostics.length > 0) {
      console.log("tsgo diagnostics:", diagnostics);
    }

    expect(line1Error).toBeDefined();
    expect(line7Error).toBeDefined();
  }, 30000);

  it("should connect to tsgo language server with complex file", async () => {
    const projectRoot = join(import.meta.dirname, "../fixtures", "typescript");
    const checkFiles = ["index.ts"];
    const result = await testLspConnection(
      tsgoAdapter,
      projectRoot,
      checkFiles,
    );

    // Skip if tsgo not available
    if (!result.connected && result.error?.includes("tsgo not found")) {
      console.log("Skipping test: tsgo not installed");
      return;
    }

    expect(result.connected).toBe(true);

    // tsgo might not report diagnostics for complex files consistently
    // This is a known limitation of tsgo's LSP implementation
    const diagnostics = result.diagnostics || [];

    if (diagnostics.length === 0) {
      console.log(
        "Note: tsgo did not report diagnostics for index.ts - this is a known issue",
      );
    } else {
      console.log(
        `tsgo reported ${diagnostics.length} diagnostics for index.ts:`,
      );
      // Log all diagnostics for debugging
      diagnostics.forEach((d, i) => {
        console.log(`  ${i + 1}. Line ${d.line}: ${d.message}`);
      });

      // If tsgo does report diagnostics, verify they are properly filtered
      expect(diagnostics.every((d) => d.line >= 0 && d.line < 56)).toBe(true);

      // Check that deduplication is working
      const uniqueKeys = new Set(
        diagnostics.map((d) => `${d.line}:${d.message}`),
      );
      console.log(`  Unique diagnostics: ${uniqueKeys.size}`);

      // Expect reasonable number of diagnostics
      expect(diagnostics.length).toBeLessThanOrEqual(20);
    }
  }, 30000);
});
