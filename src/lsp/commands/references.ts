import type { Location } from "vscode-languageserver-types";
import type { LSPCommand, ReferenceParams, ReferencesResult } from "./types.ts";

export function createReferencesCommand(): LSPCommand<
  ReferenceParams,
  Location[]
> {
  return {
    method: "textDocument/references",

    buildParams(input: ReferenceParams) {
      return {
        textDocument: { uri: input.uri },
        position: input.position,
        context: {
          includeDeclaration: input.includeDeclaration ?? true,
        },
      };
    },

    processResponse(response: ReferencesResult): Location[] {
      return response ?? [];
    },
  };
}

// In-source tests using Vitest
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("ReferencesCommand", () => {
    const command = createReferencesCommand();

    describe("buildParams", () => {
      it("should build correct parameters with default includeDeclaration", () => {
        const params = command.buildParams({
          uri: "file:///test.ts",
          position: { line: 10, character: 5 },
        });

        expect(params).toEqual({
          textDocument: { uri: "file:///test.ts" },
          position: { line: 10, character: 5 },
          context: {
            includeDeclaration: true,
          },
        });
      });

      it("should respect explicit includeDeclaration value", () => {
        const params = command.buildParams({
          uri: "file:///test.ts",
          position: { line: 10, character: 5 },
          includeDeclaration: false,
        });

        expect(params).toEqual({
          textDocument: { uri: "file:///test.ts" },
          position: { line: 10, character: 5 },
          context: {
            includeDeclaration: false,
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

      it("should return Location array as is", () => {
        const locations: Location[] = [
          {
            uri: "file:///test1.ts",
            range: {
              start: { line: 5, character: 10 },
              end: { line: 5, character: 20 },
            },
          },
          {
            uri: "file:///test2.ts",
            range: {
              start: { line: 10, character: 0 },
              end: { line: 10, character: 5 },
            },
          },
        ];

        const result = command.processResponse(locations);
        expect(result).toEqual(locations);
      });

      it("should handle empty array", () => {
        const result = command.processResponse([]);
        expect(result).toEqual([]);
      });
    });
  });
}
