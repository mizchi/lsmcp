/**
 * Parses a line number from either a number or a string match
 * @param fullText Full text content of the file
 * @param line Line number (1-based) or string to match
 * @returns 0-based line index with line text or error message
 */
export function parseLineNumber(
  fullText: string,
  line: number | string,
): { targetLine: number; lineText: string } | { error: string } {
  const lines = fullText.split("\n");

  if (typeof line === "string") {
    const lineIndex = lines.findIndex((l) => l.includes(line));
    if (lineIndex === -1) {
      return { error: `Line containing "${line}" not found` };
    }
    return { targetLine: lineIndex, lineText: lines[lineIndex] };
  } else {
    const lineIndex = line - 1; // Convert to 0-based
    if (lineIndex < 0 || lineIndex >= lines.length) {
      return { error: `Line ${line} not found` };
    }
    return { targetLine: lineIndex, lineText: lines[lineIndex] };
  }
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("parseLineNumber", () => {
    it("should parse line number to 0-based index", () => {
      const fullText = "line 1\nline 2\nline 3";

      const result = parseLineNumber(fullText, 2);
      expect(result).toEqual({ targetLine: 1, lineText: "line 2" });
    });

    it("should find line by string match", () => {
      const fullText = "const foo = 1;\nconst bar = 2;\nconst baz = 3;";

      const result = parseLineNumber(fullText, "bar = 2");
      expect(result).toEqual({ targetLine: 1, lineText: "const bar = 2;" });
    });

    it("should return error if string not found", () => {
      const fullText = "const foo = 1;\nconst bar = 2;";

      const result = parseLineNumber(fullText, "not found");
      expect(result).toEqual({
        error: 'Line containing "not found" not found',
      });
    });

    it("should return error if line number out of bounds", () => {
      const fullText = "line 1\nline 2";

      const result = parseLineNumber(fullText, 5);
      expect(result).toEqual({
        error: "Line 5 not found",
      });
    });
  });
}
