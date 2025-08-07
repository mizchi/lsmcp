import { describe, it, expect } from "vitest";
import { SymbolKind } from "vscode-languageserver-types";
import {
  parseSymbolKind,
  getSymbolKindName,
  SYMBOL_KINDS,
} from "./symbolKindTypes.ts";

describe("parseSymbolKind", () => {
  describe("string input", () => {
    it("should parse valid string kind", () => {
      const result = parseSymbolKind("Class");
      expect(result).toEqual([SymbolKind.Class]);
    });

    it("should parse array of strings", () => {
      const result = parseSymbolKind(["Class", "Interface", "Function"]);
      expect(result).toEqual([
        SymbolKind.Class,
        SymbolKind.Interface,
        SymbolKind.Function,
      ]);
    });

    it("should throw error for invalid string", () => {
      expect(() => parseSymbolKind("InvalidKind")).toThrow(
        'Unknown symbol kind: "InvalidKind"',
      );
    });
  });

  describe("case-insensitive matching", () => {
    it("should handle various case combinations", () => {
      expect(parseSymbolKind("class")).toEqual([SymbolKind.Class]);
      expect(parseSymbolKind("CLASS")).toEqual([SymbolKind.Class]);
      expect(parseSymbolKind("Class")).toEqual([SymbolKind.Class]);
      expect(parseSymbolKind("ClAsS")).toEqual([SymbolKind.Class]);
      expect(parseSymbolKind("interface")).toEqual([SymbolKind.Interface]);
      expect(parseSymbolKind("INTERFACE")).toEqual([SymbolKind.Interface]);
      expect(parseSymbolKind("enumMember")).toEqual([SymbolKind.EnumMember]);
      expect(parseSymbolKind("enummember")).toEqual([SymbolKind.EnumMember]);
      expect(parseSymbolKind("ENUMMEMBER")).toEqual([SymbolKind.EnumMember]);
    });
  });

  describe("special cases", () => {
    it("should handle mixed case arrays", () => {
      const result = parseSymbolKind(["class", "INTERFACE", "Function"]);
      expect(result).toEqual([
        SymbolKind.Class,
        SymbolKind.Interface,
        SymbolKind.Function,
      ]);
    });

    it("should handle undefined input", () => {
      const result = parseSymbolKind(undefined);
      expect(result).toBeUndefined();
    });

    it("should handle null input", () => {
      const result = parseSymbolKind(null as any);
      expect(result).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should throw error for numeric input", () => {
      // @ts-expect-error - Testing invalid type
      expect(() => parseSymbolKind(5)).toThrow(
        "Invalid kind type: number. Expected string",
      );
      // @ts-expect-error - Testing invalid type
      expect(() => parseSymbolKind(["Class", 5])).toThrow(
        "Invalid kind type: number. Expected string",
      );
    });

    it("should throw error for invalid type", () => {
      // @ts-expect-error - Testing invalid type
      expect(() => parseSymbolKind({})).toThrow("Invalid kind type");
      // @ts-expect-error - Testing invalid type
      expect(() => parseSymbolKind(true)).toThrow("Invalid kind type");
    });

    it("should provide helpful error messages", () => {
      try {
        parseSymbolKind("InvalidKind");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        if (error instanceof Error) {
          expect(error.message).toContain("Unknown symbol kind");
          expect(error.message).toContain("Valid options:");
        }
      }
    });
  });
});

describe("symbol kind mapping", () => {
  it("should have correct numeric values for all kinds", () => {
    expect(SYMBOL_KINDS.Class).toBe(5);
    expect(SYMBOL_KINDS.Interface).toBe(11);
    expect(SYMBOL_KINDS.Function).toBe(12);
    expect(SYMBOL_KINDS.Variable).toBe(13);
    expect(SYMBOL_KINDS.Method).toBe(6);
  });

  it("should get correct name from numeric kind", () => {
    expect(getSymbolKindName(5)).toBe("Class");
    expect(getSymbolKindName(11)).toBe("Interface");
    expect(getSymbolKindName(12)).toBe("Function");
  });
});
