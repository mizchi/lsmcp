import type { SignatureHelp } from "vscode-languageserver-types";
import type {
  LSPCommand,
  SignatureHelpResult,
  TextDocumentPositionParams,
} from "./types.ts";

export function createSignatureHelpCommand(): LSPCommand<
  TextDocumentPositionParams,
  SignatureHelp | null
> {
  return {
    method: "textDocument/signatureHelp",

    buildParams(input: TextDocumentPositionParams) {
      return {
        textDocument: { uri: input.uri },
        position: input.position,
      };
    },

    processResponse(response: SignatureHelpResult): SignatureHelp | null {
      return response;
    },
  };
}

// In-source tests using Vitest
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("SignatureHelpCommand", () => {
    const command = createSignatureHelpCommand();

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

      it("should handle undefined response", () => {
        const result = command.processResponse(undefined as any);
        expect(result).toBeUndefined();
      });

      it("should return SignatureHelp as is", () => {
        const signatureHelp: SignatureHelp = {
          signatures: [
            {
              label: "function(a: string, b: number): void",
              documentation: "This is a function",
              parameters: [
                {
                  label: "a: string",
                  documentation: "The first parameter",
                },
                {
                  label: "b: number",
                  documentation: "The second parameter",
                },
              ],
            },
          ],
          activeSignature: 0,
          activeParameter: 1,
        };

        const result = command.processResponse(signatureHelp);
        expect(result).toEqual(signatureHelp);
      });

      it("should handle SignatureHelp with multiple signatures", () => {
        const signatureHelp: SignatureHelp = {
          signatures: [
            {
              label: "function(a: string): void",
            },
            {
              label: "function(a: string, b: number): void",
            },
          ],
          activeSignature: 1,
        };

        const result = command.processResponse(signatureHelp);
        expect(result).toEqual(signatureHelp);
      });

      it("should handle SignatureHelp without active indices", () => {
        const signatureHelp: SignatureHelp = {
          signatures: [
            {
              label: "function(): void",
            },
          ],
        };

        const result = command.processResponse(signatureHelp);
        expect(result).toEqual(signatureHelp);
      });
    });
  });
}
