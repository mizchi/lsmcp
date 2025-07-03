import type { Range, WorkspaceEdit } from "vscode-languageserver-types";
import type {
  LSPCommand,
  RenameParams,
  RenameResult,
  TextDocumentPositionParams,
} from "./types.ts";

export function createPrepareRenameCommand(): LSPCommand<
  TextDocumentPositionParams,
  Range | null
> {
  return {
    method: "textDocument/prepareRename",

    buildParams(input: TextDocumentPositionParams) {
      return {
        textDocument: { uri: input.uri },
        position: input.position,
      };
    },

    processResponse(response: unknown): Range | null {
      if (!response) {
        return null;
      }

      // Handle { range: Range } format
      if (typeof response === "object" && "range" in response) {
        return (response as any).range;
      }

      // Handle Range format
      return response as Range;
    },
  };
}

export function createRenameCommand(): LSPCommand<
  RenameParams,
  WorkspaceEdit | null
> {
  return {
    method: "textDocument/rename",

    buildParams(input: RenameParams) {
      return {
        textDocument: { uri: input.uri },
        position: input.position,
        newName: input.newName,
      };
    },

    processResponse(response: RenameResult): WorkspaceEdit | null {
      return response;
    },
  };
}

// In-source tests using Vitest
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("PrepareRenameCommand", () => {
    const command = createPrepareRenameCommand();

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

      it("should handle Range response", () => {
        const range: Range = {
          start: { line: 10, character: 5 },
          end: { line: 10, character: 15 },
        };

        const result = command.processResponse(range);
        expect(result).toEqual(range);
      });

      it("should handle { range: Range } response", () => {
        const range: Range = {
          start: { line: 10, character: 5 },
          end: { line: 10, character: 15 },
        };

        const result = command.processResponse({ range });
        expect(result).toEqual(range);
      });
    });
  });

  describe("RenameCommand", () => {
    const command = createRenameCommand();

    describe("buildParams", () => {
      it("should build correct parameters", () => {
        const params = command.buildParams({
          uri: "file:///test.ts",
          position: { line: 10, character: 5 },
          newName: "newSymbolName",
        });

        expect(params).toEqual({
          textDocument: { uri: "file:///test.ts" },
          position: { line: 10, character: 5 },
          newName: "newSymbolName",
        });
      });
    });

    describe("processResponse", () => {
      it("should handle null response", () => {
        const result = command.processResponse(null);
        expect(result).toBeNull();
      });

      it("should handle WorkspaceEdit response", () => {
        const edit: WorkspaceEdit = {
          changes: {
            "file:///test.ts": [
              {
                range: {
                  start: { line: 10, character: 5 },
                  end: { line: 10, character: 15 },
                },
                newText: "newName",
              },
            ],
          },
        };

        const result = command.processResponse(edit);
        expect(result).toEqual(edit);
      });

      it("should handle empty WorkspaceEdit", () => {
        const edit: WorkspaceEdit = {
          changes: {},
        };

        const result = command.processResponse(edit);
        expect(result).toEqual(edit);
      });
    });
  });
}
