import { describe, it, expect } from "vitest";
import { parseFilePatterns } from "./filePatternParser.ts";

describe("parseFilePatterns", () => {
  it("should handle simple comma-separated patterns", () => {
    const result = parseFilePatterns("**/*.ts,**/*.tsx,**/*.js");
    expect(result).toEqual(["**/*.ts", "**/*.tsx", "**/*.js"]);
  });

  it("should handle brace expansion", () => {
    const result = parseFilePatterns("**/*.{ts,tsx}");
    expect(result).toEqual(["**/*.ts", "**/*.tsx"]);
  });

  it("should handle multiple brace expansions", () => {
    const result = parseFilePatterns("**/*.{ts,tsx,js,jsx}");
    expect(result).toEqual(["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]);
  });

  it("should handle mixed patterns", () => {
    const result = parseFilePatterns(
      "src/**/*.{ts,tsx},tests/**/*.js,lib/**/*.ts",
    );
    expect(result).toEqual([
      "src/**/*.ts",
      "src/**/*.tsx",
      "tests/**/*.js",
      "lib/**/*.ts",
    ]);
  });

  it("should handle complex brace patterns", () => {
    const result = parseFilePatterns("**/*.{c,cpp,h,hpp}");
    expect(result).toEqual(["**/*.c", "**/*.cpp", "**/*.h", "**/*.hpp"]);
  });

  it("should handle spaces around commas", () => {
    const result = parseFilePatterns("**/*.ts , **/*.tsx , **/*.js");
    expect(result).toEqual(["**/*.ts", "**/*.tsx", "**/*.js"]);
  });

  it("should handle single pattern", () => {
    const result = parseFilePatterns("**/*.ts");
    expect(result).toEqual(["**/*.ts"]);
  });

  it("should handle empty string", () => {
    const result = parseFilePatterns("");
    expect(result).toEqual([]);
  });

  it("should remove duplicates", () => {
    const result = parseFilePatterns("**/*.ts,**/*.ts,**/*.tsx");
    expect(result).toEqual(["**/*.ts", "**/*.tsx"]);
  });

  it("should handle negation patterns", () => {
    const result = parseFilePatterns("**/*.ts,!node_modules/**");
    expect(result).toEqual(["**/*.ts", "!node_modules/**"]);
  });

  it("should handle nested braces", () => {
    const result = parseFilePatterns("src/**/*.{ts,tsx},dist/**/*.{js,mjs}");
    expect(result).toEqual([
      "src/**/*.ts",
      "src/**/*.tsx",
      "dist/**/*.js",
      "dist/**/*.mjs",
    ]);
  });
});
