import type { TextEdit } from "vscode-languageserver-types";
import type {
  FormattingParams,
  FormattingResult,
  LSPCommand,
  RangeFormattingParams,
} from "./types.ts";

export function createDocumentFormattingCommand(): LSPCommand<
  FormattingParams,
  TextEdit[]
> {
  return {
    method: "textDocument/formatting",

    buildParams(input: FormattingParams) {
      return {
        textDocument: { uri: input.uri },
        options: input.options,
      };
    },

    processResponse(response: FormattingResult): TextEdit[] {
      return response ?? [];
    },
  };
}

export function createDocumentRangeFormattingCommand(): LSPCommand<
  RangeFormattingParams,
  TextEdit[]
> {
  return {
    method: "textDocument/rangeFormatting",

    buildParams(input: RangeFormattingParams) {
      return {
        textDocument: { uri: input.uri },
        range: input.range,
        options: input.options,
      };
    },

    processResponse(response: FormattingResult): TextEdit[] {
      return response ?? [];
    },
  };
}

// In-source tests using Vitest
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  type FormattingOptions =
    import("vscode-languageserver-types").FormattingOptions;

  describe("DocumentFormattingCommand", () => {
    const command = createDocumentFormattingCommand();

    describe("buildParams", () => {
      it("should build correct parameters", () => {
        const options: FormattingOptions = {
          tabSize: 2,
          insertSpaces: true,
        };

        const params = command.buildParams({
          uri: "file:///test.ts",
          options,
        });

        expect(params).toEqual({
          textDocument: { uri: "file:///test.ts" },
          options,
        });
      });
    });

    describe("processResponse", () => {
      it("should handle null response", () => {
        const result = command.processResponse(null);
        expect(result).toEqual([]);
      });

      it("should handle TextEdit array", () => {
        const edits: TextEdit[] = [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 10 },
            },
            newText: "formatted",
          },
        ];

        const result = command.processResponse(edits);
        expect(result).toEqual(edits);
      });

      it("should handle empty array", () => {
        const result = command.processResponse([]);
        expect(result).toEqual([]);
      });
    });
  });

  describe("DocumentRangeFormattingCommand", () => {
    const command = createDocumentRangeFormattingCommand();

    describe("buildParams", () => {
      it("should build correct parameters", () => {
        const options: FormattingOptions = {
          tabSize: 2,
          insertSpaces: true,
        };

        const range = {
          start: { line: 10, character: 0 },
          end: { line: 20, character: 0 },
        };

        const params = command.buildParams({
          uri: "file:///test.ts",
          range,
          options,
        });

        expect(params).toEqual({
          textDocument: { uri: "file:///test.ts" },
          range,
          options,
        });
      });
    });

    describe("processResponse", () => {
      it("should handle null response", () => {
        const result = command.processResponse(null);
        expect(result).toEqual([]);
      });

      it("should handle TextEdit array", () => {
        const edits: TextEdit[] = [
          {
            range: {
              start: { line: 10, character: 0 },
              end: { line: 15, character: 0 },
            },
            newText: "formatted range",
          },
        ];

        const result = command.processResponse(edits);
        expect(result).toEqual(edits);
      });
    });
  });
}
