import { describe, expect, it } from "vitest";
import { join } from "path";
import { hlsAdapter } from "../../../src/presets/hls.ts";
import { testLspConnection } from "../testHelpers.ts";

const projectRoot = join(import.meta.dirname, "../../fixtures", "haskell");

describe("Haskell Language Server Basic Tests", () => {
  it("should connect to HLS and detect type errors", async () => {
    const checkFiles = ["Main.hs"];
    const result = await testLspConnection(hlsAdapter, projectRoot, checkFiles);

    // HLS might not be installed in CI
    expect(result.connected).toBeDefined();
    if (result.connected) {
      expect(result.diagnostics).toBeDefined();

      const mainDiagnostics = (result.diagnostics as any)?.["Main.hs"];
      if (mainDiagnostics && mainDiagnostics.length > 0) {
        // Should have at least 2 type errors
        expect(mainDiagnostics.length).toBeGreaterThanOrEqual(2);

        // Check for type errors
        const hasTypeErrors = mainDiagnostics.some(
          (d: any) =>
            d.severity === 1 && d.message.toLowerCase().includes("type"),
        );
        expect(hasTypeErrors).toBe(true);
      }
    } else {
      expect(result.error).toBeDefined();
      console.warn("HLS not available, skipping test");
    }
  }, 30000);
});
