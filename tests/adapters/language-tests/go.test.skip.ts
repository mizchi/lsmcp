import { describe, expect, it } from "vitest";
import { join } from "path";
import type { LspAdapter } from "../../../src/types.ts";
import { testLspConnection } from "../testHelpers.ts";

describe.skip("Go Adapter", () => {
  it("should connect to Go language server", async () => {
    const projectRoot = join(import.meta.dirname, "../fixtures", "go");
    const checkFiles = ["main.go"];

    // Create a Go adapter inline
    const goAdapter: LspAdapter = {
      id: "gopls",
      name: "Go Language Server",
      baseLanguage: "go",
      description: "Official Go language server",
      bin: "gopls",
      args: [],
      initializationOptions: {
        "ui.documentation.hoverKind": "FullDocumentation",
        "ui.completion.usePlaceholders": true,
        "ui.semanticTokens": true,
      },
    };

    const result = await testLspConnection(goAdapter, projectRoot, checkFiles);
    expect(result).toMatchInlineSnapshot(`
      {
        "connected": true,
        "diagnostics": [],
      }
    `);
  }, 30000);
});
