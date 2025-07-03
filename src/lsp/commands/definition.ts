import type { Location } from "vscode-languageserver-types";
import type {
  DefinitionResult,
  LSPCommand,
  TextDocumentPositionParams,
} from "./types.ts";
import { isLocationLinkArray, locationLinkToLocation } from "./types.ts";

// Factory function that returns an LSPCommand implementation
export function createDefinitionCommand(): LSPCommand<
  TextDocumentPositionParams,
  Location[]
> {
  return {
    method: "textDocument/definition",

    buildParams(input: TextDocumentPositionParams) {
      return {
        textDocument: { uri: input.uri },
        position: input.position,
      };
    },

    processResponse(response: DefinitionResult): Location[] {
      if (!response) {
        return [];
      }

      // Handle single Location
      if (!Array.isArray(response)) {
        return [response as Location];
      }

      // Handle LocationLink[]
      if (isLocationLinkArray(response)) {
        return response.map(locationLinkToLocation);
      }

      // Handle Location[]
      return response as Location[];
    },
  };
}

// In-source tests using Vitest
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("DefinitionCommand", () => {
    const command = createDefinitionCommand();

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
        expect(result).toEqual([]);
      });

      it("should handle single Location", () => {
        const location: Location = {
          uri: "file:///test.ts",
          range: {
            start: { line: 5, character: 10 },
            end: { line: 5, character: 20 },
          },
        };

        const result = command.processResponse(location);
        expect(result).toEqual([location]);
      });

      it("should handle Location array", () => {
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

      it("should convert LocationLink array to Location array", () => {
        const locationLinks = [
          {
            targetUri: "file:///test1.ts",
            targetRange: {
              start: { line: 5, character: 0 },
              end: { line: 10, character: 0 },
            },
            targetSelectionRange: {
              start: { line: 5, character: 10 },
              end: { line: 5, character: 20 },
            },
          },
          {
            targetUri: "file:///test2.ts",
            targetRange: {
              start: { line: 15, character: 0 },
              end: { line: 20, character: 0 },
            },
            targetSelectionRange: {
              start: { line: 15, character: 5 },
              end: { line: 15, character: 15 },
            },
          },
        ];

        const expectedLocations: Location[] = [
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
              start: { line: 15, character: 5 },
              end: { line: 15, character: 15 },
            },
          },
        ];

        const result = command.processResponse(locationLinks);
        expect(result).toEqual(expectedLocations);
      });

      it("should use targetRange if targetSelectionRange is not available", () => {
        const locationLinks = [
          {
            targetUri: "file:///test.ts",
            targetRange: {
              start: { line: 5, character: 0 },
              end: { line: 10, character: 0 },
            },
          },
        ];

        const expectedLocations: Location[] = [
          {
            uri: "file:///test.ts",
            range: {
              start: { line: 5, character: 0 },
              end: { line: 10, character: 0 },
            },
          },
        ];

        const result = command.processResponse(locationLinks);
        expect(result).toEqual(expectedLocations);
      });
    });
  });
}
