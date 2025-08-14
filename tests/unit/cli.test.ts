import { describe, it, expect } from "vitest";
import { parseArgs } from "util";
import { parseFilePatterns } from "../../src/utils/filePatternParser.ts";

describe("CLI --files option", () => {
  it("should parse comma-separated file patterns", () => {
    // Simulate the parsing logic from lsmcp.ts
    const args = ["--files", "**/*.ts,**/*.tsx,**/*.js,**/*.jsx"];
    const { values } = parseArgs({
      args,
      options: {
        files: {
          type: "string",
        },
      },
    });

    expect(values.files).toBe("**/*.ts,**/*.tsx,**/*.js,**/*.jsx");

    // Test the split logic
    const filePatterns = values.files?.split(",").map((p) => p.trim());
    expect(filePatterns).toEqual([
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx",
    ]);
  });

  it("should handle file patterns with spaces", () => {
    const args = ["--files", "src/**/*.ts, tests/**/*.ts, lib/**/*.ts"];
    const { values } = parseArgs({
      args,
      options: {
        files: {
          type: "string",
        },
      },
    });

    const filePatterns = values.files?.split(",").map((p) => p.trim());
    expect(filePatterns).toEqual([
      "src/**/*.ts",
      "tests/**/*.ts",
      "lib/**/*.ts",
    ]);
  });

  it("should handle complex glob patterns with brace expansion", () => {
    const args = ["--files", "**/*.{ts,tsx},src/**/*.js,!node_modules/**"];
    const { values } = parseArgs({
      args,
      options: {
        files: {
          type: "string",
        },
      },
    });

    // Using the new parseFilePatterns function
    const filePatterns = parseFilePatterns(values.files!);
    expect(filePatterns).toEqual([
      "**/*.ts",
      "**/*.tsx",
      "src/**/*.js",
      "!node_modules/**",
    ]);
  });

  it("should handle single pattern without comma", () => {
    const args = ["--files", "**/*.ts"];
    const { values } = parseArgs({
      args,
      options: {
        files: {
          type: "string",
        },
      },
    });

    const filePatterns = values.files?.split(",").map((p) => p.trim());
    expect(filePatterns).toEqual(["**/*.ts"]);
  });
});
