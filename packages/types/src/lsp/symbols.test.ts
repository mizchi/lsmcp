import { describe, it, expect } from "vitest";
import { parseSymbolKind, SymbolKind } from "./symbols.ts";

describe("parseSymbolKind", () => {
  describe("String input", () => {
    it("should parse single string kind", () => {
      const result = parseSymbolKind("Class");
      expect(result).toEqual([SymbolKind.Class]);
    });

    it("should handle case-insensitive strings", () => {
      expect(parseSymbolKind("class")).toEqual([SymbolKind.Class]);
      expect(parseSymbolKind("CLASS")).toEqual([SymbolKind.Class]);
      expect(parseSymbolKind("ClAsS")).toEqual([SymbolKind.Class]);
    });

    it("should handle all valid symbol kinds", () => {
      expect(parseSymbolKind("File")).toEqual([SymbolKind.File]);
      expect(parseSymbolKind("Module")).toEqual([SymbolKind.Module]);
      expect(parseSymbolKind("Namespace")).toEqual([SymbolKind.Namespace]);
      expect(parseSymbolKind("Package")).toEqual([SymbolKind.Package]);
      expect(parseSymbolKind("Class")).toEqual([SymbolKind.Class]);
      expect(parseSymbolKind("Method")).toEqual([SymbolKind.Method]);
      expect(parseSymbolKind("Property")).toEqual([SymbolKind.Property]);
      expect(parseSymbolKind("Field")).toEqual([SymbolKind.Field]);
      expect(parseSymbolKind("Constructor")).toEqual([SymbolKind.Constructor]);
      expect(parseSymbolKind("Enum")).toEqual([SymbolKind.Enum]);
      expect(parseSymbolKind("Interface")).toEqual([SymbolKind.Interface]);
      expect(parseSymbolKind("Function")).toEqual([SymbolKind.Function]);
      expect(parseSymbolKind("Variable")).toEqual([SymbolKind.Variable]);
      expect(parseSymbolKind("Constant")).toEqual([SymbolKind.Constant]);
      expect(parseSymbolKind("String")).toEqual([SymbolKind.String]);
      expect(parseSymbolKind("Number")).toEqual([SymbolKind.Number]);
      expect(parseSymbolKind("Boolean")).toEqual([SymbolKind.Boolean]);
      expect(parseSymbolKind("Array")).toEqual([SymbolKind.Array]);
      expect(parseSymbolKind("Object")).toEqual([SymbolKind.Object]);
      expect(parseSymbolKind("Key")).toEqual([SymbolKind.Key]);
      expect(parseSymbolKind("Null")).toEqual([SymbolKind.Null]);
      expect(parseSymbolKind("EnumMember")).toEqual([SymbolKind.EnumMember]);
      expect(parseSymbolKind("Struct")).toEqual([SymbolKind.Struct]);
      expect(parseSymbolKind("Event")).toEqual([SymbolKind.Event]);
      expect(parseSymbolKind("Operator")).toEqual([SymbolKind.Operator]);
      expect(parseSymbolKind("TypeParameter")).toEqual([SymbolKind.TypeParameter]);
    });

    it("should throw error for invalid string kind", () => {
      expect(() => parseSymbolKind("InvalidKind")).toThrow(
        'Unknown symbol kind: "InvalidKind"',
      );
    });
  });

  describe("Array input", () => {
    it("should parse array of strings", () => {
      const result = parseSymbolKind(["Class", "Interface", "Function"]);
      expect(result).toEqual([SymbolKind.Class, SymbolKind.Interface, SymbolKind.Function]);
    });

    it("should handle mixed case in arrays", () => {
      const result = parseSymbolKind(["CLASS", "interface", "FuNcTiOn"]);
      expect(result).toEqual([SymbolKind.Class, SymbolKind.Interface, SymbolKind.Function]);
    });

    it("should throw error for invalid kind in array", () => {
      expect(() => parseSymbolKind(["Class", "InvalidKind"])).toThrow(
        'Unknown symbol kind: "InvalidKind"',
      );
    });
  });

  describe("JSON string input", () => {
    it("should parse JSON-encoded string array", () => {
      const result = parseSymbolKind('["Class", "Interface"]');
      expect(result).toEqual([SymbolKind.Class, SymbolKind.Interface]);
    });

    it("should parse JSON array with mixed case", () => {
      const result = parseSymbolKind('["class", "INTERFACE", "Function"]');
      expect(result).toEqual([SymbolKind.Class, SymbolKind.Interface, SymbolKind.Function]);
    });

    it("should treat non-JSON string as single value and throw error", () => {
      expect(() => parseSymbolKind("[NotJSON")).toThrow(
        'Unknown symbol kind: "[NotJSON"',
      );
    });
  });

  describe("Numeric input rejection", () => {
    it("should throw error for numeric input", () => {
      expect(() => parseSymbolKind(5 as any)).toThrow(
        "Invalid kind type: number. Expected string.",
      );
    });

    it("should throw error for numeric array", () => {
      expect(() => parseSymbolKind([5, 11, 12] as any)).toThrow(
        "Invalid kind type: number. Expected string.",
      );
    });

    it("should throw error for mixed string and number array", () => {
      expect(() => parseSymbolKind(["Class", 11] as any)).toThrow(
        "Invalid kind type: number. Expected string.",
      );
    });

    it("should throw error for JSON-encoded numeric array", () => {
      expect(() => parseSymbolKind("[5, 11]")).toThrow(
        "Invalid kind type: number. Expected string.",
      );
    });
  });

  describe("Edge cases", () => {
    it("should return undefined for undefined input", () => {
      expect(parseSymbolKind(undefined)).toBeUndefined();
    });

    it("should return undefined for null input", () => {
      expect(parseSymbolKind(null as any)).toBeUndefined();
    });

    it("should handle empty array", () => {
      expect(parseSymbolKind([])).toEqual([]);
    });

    it("should handle JSON empty array", () => {
      expect(parseSymbolKind("[]")).toEqual([]);
    });

    it("should throw error for other types", () => {
      expect(() => parseSymbolKind({} as any)).toThrow(
        "Invalid kind type: object. Expected string.",
      );
      expect(() => parseSymbolKind(true as any)).toThrow(
        "Invalid kind type: boolean. Expected string.",
      );
    });
  });
});