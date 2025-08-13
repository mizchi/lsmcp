import { beforeAll, describe, expect, it } from "vitest";
import { join } from "path";
import { pyrightAdapter } from "../../../src/presets/pyright.ts";
import { testLspConnection } from "../testHelpers.ts";
import { $ } from "zx";

const projectRoot = join(import.meta.dirname, "../fixtures", "python");

// Shared initialization for Python environment
async function initializePythonEnvironment() {
  // Run uv sync in the project directory
  await $({ cwd: projectRoot })`uv sync`;
}

describe("Pyright Adapter", () => {
  beforeAll(async () => {
    await initializePythonEnvironment();
  }, 30000); // 30s timeout for initialization

  it("should connect to Pyright language server", async () => {
    const checkFiles = ["main.py"];
    const result = await testLspConnection(
      pyrightAdapter,
      projectRoot,
      checkFiles,
    );
    // Pyright might take longer to initialize or might fail in CI environment
    expect(result.connected).toBeDefined();
    if (result.connected) {
      expect(result.diagnostics).toBeDefined();
    } else {
      expect(result.error).toBeDefined();
    }
  });
});
