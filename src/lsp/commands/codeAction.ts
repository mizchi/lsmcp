import type { CodeAction, Command } from "vscode-languageserver-types";
import type {
  CodeActionParams,
  CodeActionResult,
  LSPCommand,
} from "./types.ts";

export function createCodeActionCommand(): LSPCommand<
  CodeActionParams,
  (Command | CodeAction)[]
> {
  return {
    method: "textDocument/codeAction",

    buildParams(input: CodeActionParams) {
      return {
        textDocument: { uri: input.uri },
        range: input.range,
        context: {
          diagnostics: input.diagnostics ?? [],
        },
      };
    },

    processResponse(response: CodeActionResult): (Command | CodeAction)[] {
      return response ?? [];
    },
  };
}

// In-source tests using Vitest
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  type Diagnostic = import("vscode-languageserver-types").Diagnostic;

  describe("CodeActionCommand", () => {
    const command = createCodeActionCommand();

    describe("buildParams", () => {
      it("should build correct parameters without diagnostics", () => {
        const range = {
          start: { line: 10, character: 0 },
          end: { line: 20, character: 0 },
        };

        const params = command.buildParams({
          uri: "file:///test.ts",
          range,
        });

        expect(params).toEqual({
          textDocument: { uri: "file:///test.ts" },
          range,
          context: {
            diagnostics: [],
          },
        });
      });

      it("should build correct parameters with diagnostics", () => {
        const range = {
          start: { line: 10, character: 0 },
          end: { line: 20, character: 0 },
        };

        const diagnostics: Diagnostic[] = [
          {
            range: {
              start: { line: 10, character: 5 },
              end: { line: 10, character: 10 },
            },
            severity: 1,
            message: "Error message",
          },
        ];

        const params = command.buildParams({
          uri: "file:///test.ts",
          range,
          diagnostics,
        });

        expect(params).toEqual({
          textDocument: { uri: "file:///test.ts" },
          range,
          context: {
            diagnostics,
          },
        });
      });
    });

    describe("processResponse", () => {
      it("should handle null response", () => {
        const result = command.processResponse(null);
        expect(result).toEqual([]);
      });

      it("should handle undefined response", () => {
        const result = command.processResponse(undefined);
        expect(result).toEqual([]);
      });

      it("should handle Command array", () => {
        const commands: Command[] = [
          {
            title: "Fix typo",
            command: "editor.action.quickFix",
            arguments: ["arg1", "arg2"],
          },
        ];

        const result = command.processResponse(commands);
        expect(result).toEqual(commands);
      });

      it("should handle CodeAction array", () => {
        const codeActions: CodeAction[] = [
          {
            title: "Add missing import",
            kind: "quickfix",
            edit: {
              changes: {
                "file:///test.ts": [
                  {
                    range: {
                      start: { line: 0, character: 0 },
                      end: { line: 0, character: 0 },
                    },
                    newText: "import { foo } from './foo';\n",
                  },
                ],
              },
            },
          },
        ];

        const result = command.processResponse(codeActions);
        expect(result).toEqual(codeActions);
      });

      it("should handle mixed Command and CodeAction array", () => {
        const mixed: (Command | CodeAction)[] = [
          {
            title: "Fix typo",
            command: "editor.action.quickFix",
          },
          {
            title: "Add missing import",
            kind: "quickfix",
            edit: {
              changes: {},
            },
          },
        ];

        const result = command.processResponse(mixed);
        expect(result).toEqual(mixed);
      });

      it("should handle empty array", () => {
        const result = command.processResponse([]);
        expect(result).toEqual([]);
      });
    });
  });
}
