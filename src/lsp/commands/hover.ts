import type { Hover, MarkupContent } from "vscode-languageserver-types";
import type {
  HoverResult,
  LSPCommand,
  TextDocumentPositionParams,
} from "./types.ts";

export function createHoverCommand(): LSPCommand<
  TextDocumentPositionParams,
  Hover | null
> {
  const normalizeContents = (
    contents: string | { value: string } | MarkupContent | MarkupContent[],
  ): MarkupContent => {
    // Handle string
    if (typeof contents === "string") {
      return {
        kind: "markdown",
        value: contents,
      };
    }

    // Handle { value: string } format
    if (
      typeof contents === "object" &&
      "value" in contents &&
      !("kind" in contents)
    ) {
      return {
        kind: "markdown",
        value: contents.value,
      };
    }

    // Handle MarkupContent
    if (typeof contents === "object" && "kind" in contents) {
      return contents as MarkupContent;
    }

    // Handle MarkupContent[]
    if (Array.isArray(contents)) {
      // Combine multiple contents into one
      const combined = contents
        .map((c) => {
          if (typeof c === "string") return c;
          if ("value" in c) return c.value;
          return "";
        })
        .join("\n\n");

      return {
        kind: "markdown",
        value: combined,
      };
    }

    // Fallback
    return {
      kind: "plaintext",
      value: String(contents),
    };
  };

  return {
    method: "textDocument/hover",

    buildParams(input: TextDocumentPositionParams) {
      return {
        textDocument: { uri: input.uri },
        position: input.position,
      };
    },

    processResponse(response: HoverResult): Hover | null {
      if (!response) {
        return null;
      }

      // Normalize the hover response to always have a consistent structure
      const contents = normalizeContents(response.contents);

      return {
        contents,
        range: (response as any).range,
      };
    },
  };
}

// In-source tests using Vitest
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("HoverCommand", () => {
    const command = createHoverCommand();

    describe("buildParams", () => {
      it("should build correct parameters", () => {
        const params = command.buildParams({
          uri: "file:///test.ts",
          position: { line: 10, character: 5 },
        });

        expect(params).toEqual({
          textDocument: { uri: "file:///test.ts" },
          position: { line: 10, character: 5 },
        });
      });
    });

    describe("processResponse", () => {
      it("should handle null response", () => {
        const result = command.processResponse(null);
        expect(result).toBeNull();
      });

      it("should handle string contents", () => {
        const result = command.processResponse({
          contents: "This is a hover message",
        });

        expect(result).toEqual({
          contents: {
            kind: "markdown",
            value: "This is a hover message",
          },
          range: undefined,
        });
      });

      it("should handle { value: string } contents", () => {
        const result = command.processResponse({
          contents: { value: "This is a hover message" },
        });

        expect(result).toEqual({
          contents: {
            kind: "markdown",
            value: "This is a hover message",
          },
          range: undefined,
        });
      });

      it("should handle MarkupContent", () => {
        const result = command.processResponse({
          contents: {
            kind: "markdown",
            value: "# Header\n\nThis is markdown",
          },
        });

        expect(result).toEqual({
          contents: {
            kind: "markdown",
            value: "# Header\n\nThis is markdown",
          },
          range: undefined,
        });
      });

      it("should handle MarkupContent array", () => {
        const result = command.processResponse({
          contents: [
            { kind: "markdown", value: "Part 1" },
            { kind: "markdown", value: "Part 2" },
          ],
        });

        expect(result).toEqual({
          contents: {
            kind: "markdown",
            value: "Part 1\n\nPart 2",
          },
          range: undefined,
        });
      });

      it("should preserve range if provided", () => {
        const range = {
          start: { line: 10, character: 5 },
          end: { line: 10, character: 15 },
        };

        const result = command.processResponse({
          contents: "Hover text",
          range,
        });

        expect(result).toEqual({
          contents: {
            kind: "markdown",
            value: "Hover text",
          },
          range,
        });
      });
    });
  });
}
