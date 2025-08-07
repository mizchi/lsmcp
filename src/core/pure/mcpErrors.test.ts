import { describe, it, expect } from "vitest";
import { MCPToolError } from "./mcpErrors.ts";

describe("MCPToolError", () => {
  describe("constructor", () => {
    it("should create an error with message and code", () => {
      const error = new MCPToolError("Test error", "TEST_CODE");

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_CODE");
      expect(error.name).toBe("MCPToolError");
      expect(error.suggestions).toEqual([]);
      expect(error.relatedTools).toEqual([]);
    });

    it("should create error with suggestions", () => {
      const suggestions = ["Try this", "Or try that"];
      const error = new MCPToolError("Test error", "TEST_CODE", suggestions);

      expect(error.suggestions).toEqual(suggestions);
    });

    it("should create error with related tools", () => {
      const relatedTools = ["tool1", "tool2"];
      const error = new MCPToolError(
        "Test error",
        "TEST_CODE",
        [],
        relatedTools,
      );

      expect(error.relatedTools).toEqual(relatedTools);
    });

    it("should create error with all parameters", () => {
      const error = new MCPToolError(
        "Complex error",
        "COMPLEX_CODE",
        ["Suggestion 1", "Suggestion 2"],
        ["Alternative tool 1", "Alternative tool 2"],
      );

      expect(error.message).toBe("Complex error");
      expect(error.code).toBe("COMPLEX_CODE");
      expect(error.suggestions).toHaveLength(2);
      expect(error.relatedTools).toHaveLength(2);
    });
  });

  describe("format", () => {
    it("should format basic error", () => {
      const error = new MCPToolError("Basic error", "BASIC");
      const formatted = error.format();

      expect(formatted).toContain("❌ Error: Basic error");
      expect(formatted).toContain("Code: BASIC");
      expect(formatted).not.toContain("💡 Suggestions");
      expect(formatted).not.toContain("🔧 Alternative tools");
    });

    it("should format error with suggestions", () => {
      const error = new MCPToolError("Error with help", "HELP_CODE", [
        "Check your input",
        "Verify the configuration",
      ]);
      const formatted = error.format();

      expect(formatted).toContain("❌ Error: Error with help");
      expect(formatted).toContain("Code: HELP_CODE");
      expect(formatted).toContain("💡 Suggestions:");
      expect(formatted).toContain("• Check your input");
      expect(formatted).toContain("• Verify the configuration");
    });

    it("should format error with related tools", () => {
      const error = new MCPToolError(
        "Tool error",
        "TOOL_ERROR",
        [],
        ["use_alternative_tool", "try_different_approach"],
      );
      const formatted = error.format();

      expect(formatted).toContain("🔧 Alternative tools you can try:");
      expect(formatted).toContain("• use_alternative_tool");
      expect(formatted).toContain("• try_different_approach");
    });

    it("should format complete error", () => {
      const error = new MCPToolError(
        "Complete error message",
        "COMPLETE_ERROR",
        ["First suggestion", "Second suggestion", "Third suggestion"],
        ["tool_a", "tool_b"],
      );
      const formatted = error.format();

      expect(formatted).toContain("❌ Error: Complete error message");
      expect(formatted).toContain("Code: COMPLETE_ERROR");
      expect(formatted).toContain("💡 Suggestions:");
      expect(formatted).toContain("• First suggestion");
      expect(formatted).toContain("• Second suggestion");
      expect(formatted).toContain("• Third suggestion");
      expect(formatted).toContain("🔧 Alternative tools you can try:");
      expect(formatted).toContain("• tool_a");
      expect(formatted).toContain("• tool_b");
    });

    it("should handle empty suggestions array", () => {
      const error = new MCPToolError("Error", "CODE", [], ["tool"]);
      const formatted = error.format();

      expect(formatted).not.toContain("💡 Suggestions:");
      expect(formatted).toContain("🔧 Alternative tools");
    });

    it("should handle empty related tools array", () => {
      const error = new MCPToolError("Error", "CODE", ["suggestion"], []);
      const formatted = error.format();

      expect(formatted).toContain("💡 Suggestions:");
      expect(formatted).not.toContain("🔧 Alternative tools");
    });
  });

  describe("inheritance", () => {
    it("should be instanceof Error", () => {
      const error = new MCPToolError("Test", "TEST");
      expect(error).toBeInstanceOf(Error);
    });

    it("should have stack trace", () => {
      const error = new MCPToolError("Test", "TEST");
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("MCPToolError");
    });

    it("should be throwable", () => {
      expect(() => {
        throw new MCPToolError("Thrown error", "THROWN");
      }).toThrow("Thrown error");
    });

    it("should be catchable as Error", () => {
      try {
        throw new MCPToolError("Catch me", "CATCH");
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).toBeInstanceOf(MCPToolError);
      }
    });
  });
});
