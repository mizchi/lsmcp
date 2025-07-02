import { describe, expect, it } from "vitest";
import { join } from "path";
import { rustAnalyzerAdapter } from "../../../src/adapters/rust-analyzer.ts";
import { testLspConnection } from "../testHelpers.ts";

describe("Rust Analyzer Adapter", () => {
  it("should connect to Rust Analyzer", async () => {
    const projectRoot = join(import.meta.dirname, "../fixtures", "rust");
    const checkFiles = ["src/main.rs"];
    const result = await testLspConnection(
      rustAnalyzerAdapter,
      projectRoot,
      checkFiles,
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "connected": true,
        "diagnostics": [
          {
            "file": "src/main.rs",
            "line": 38,
            "message": "mismatched types
      expected \`String\`, found integer",
            "severity": 1,
            "source": "rustc",
          },
          {
            "file": "src/main.rs",
            "line": 41,
            "message": "mismatched types
      expected type \`i32\`
       found struct \`HashMap<String, u32>\`",
            "severity": 1,
            "source": "rustc",
          },
        ],
      }
    `);
  }, 30000); // Rust analyzer can be slow to initialize
});
