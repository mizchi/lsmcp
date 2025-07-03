import type {
  DocumentSymbol,
  SymbolInformation,
} from "vscode-languageserver-types";
import type {
  DocumentSymbolResult,
  LSPCommand,
  TextDocumentParams,
} from "./types.ts";

export function createDocumentSymbolsCommand(): LSPCommand<
  TextDocumentParams,
  DocumentSymbol[] | SymbolInformation[]
> {
  return {
    method: "textDocument/documentSymbol",

    buildParams(input: TextDocumentParams) {
      return {
        textDocument: { uri: input.uri },
      };
    },

    processResponse(
      response: DocumentSymbolResult,
    ): DocumentSymbol[] | SymbolInformation[] {
      return response ?? [];
    },
  };
}

// In-source tests using Vitest
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("DocumentSymbolsCommand", () => {
    const command = createDocumentSymbolsCommand();

    describe("buildParams", () => {
      it("should build correct parameters", () => {
        const params = command.buildParams({
          uri: "file:///test.ts",
        });

        expect(params).toEqual({
          textDocument: { uri: "file:///test.ts" },
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

      it("should return DocumentSymbol array as is", () => {
        const documentSymbols: DocumentSymbol[] = [
          {
            name: "MyClass",
            kind: 5, // Class
            range: {
              start: { line: 0, character: 0 },
              end: { line: 10, character: 1 },
            },
            selectionRange: {
              start: { line: 0, character: 6 },
              end: { line: 0, character: 13 },
            },
            children: [
              {
                name: "myMethod",
                kind: 6, // Method
                range: {
                  start: { line: 2, character: 2 },
                  end: { line: 4, character: 3 },
                },
                selectionRange: {
                  start: { line: 2, character: 6 },
                  end: { line: 2, character: 14 },
                },
              },
            ],
          },
        ];

        const result = command.processResponse(documentSymbols);
        expect(result).toEqual(documentSymbols);
      });

      it("should return SymbolInformation array as is", () => {
        const symbolInfos: SymbolInformation[] = [
          {
            name: "MyClass",
            kind: 5, // Class
            location: {
              uri: "file:///test.ts",
              range: {
                start: { line: 0, character: 0 },
                end: { line: 10, character: 1 },
              },
            },
          },
          {
            name: "myFunction",
            kind: 12, // Function
            location: {
              uri: "file:///test.ts",
              range: {
                start: { line: 12, character: 0 },
                end: { line: 15, character: 1 },
              },
            },
          },
        ];

        const result = command.processResponse(symbolInfos);
        expect(result).toEqual(symbolInfos);
      });

      it("should handle empty array", () => {
        const result = command.processResponse([]);
        expect(result).toEqual([]);
      });
    });
  });
}
