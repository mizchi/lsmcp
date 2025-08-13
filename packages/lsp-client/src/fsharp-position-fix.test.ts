import { describe, it, expect } from "vitest";
import { fixFSharpSymbolPositions } from "./fsharp-position-fix.ts";
import type { DocumentSymbol } from "vscode-languageserver-types";
import { SymbolKind } from "vscode-languageserver-types";

describe("F# position fix", () => {
  it("should fix positions for symbols starting with comments", () => {
    const fileContent = `module TestModule

/// This is a document comment for the function
/// It spans multiple lines to test position handling
let myFunction x =
    x + 1

/// Another comment for a type
type MyType = {
    /// Field comment
    Value: int
    /// Another field comment
    Name: string
}`;

    const symbols: DocumentSymbol[] = [
      {
        name: "myFunction",
        kind: SymbolKind.Function,
        range: {
          start: { line: 2, character: 0 }, // Points to comment
          end: { line: 5, character: 10 },
        },
        selectionRange: {
          start: { line: 2, character: 0 },
          end: { line: 2, character: 10 },
        },
      },
      {
        name: "MyType",
        kind: SymbolKind.Class,
        range: {
          start: { line: 7, character: 0 }, // Points to comment
          end: { line: 12, character: 2 },
        },
        selectionRange: {
          start: { line: 7, character: 0 },
          end: { line: 7, character: 6 },
        },
      },
    ];

    const fixed = fixFSharpSymbolPositions(symbols, fileContent);

    // myFunction should now point to line 4 (0-indexed) where "let myFunction" is
    expect(fixed[0].range.start.line).toBe(4);
    expect(fixed[0].range.start.character).toBe(4); // Position of "myFunction" in "let myFunction"

    // MyType should now point to line 8 (0-indexed) where "type MyType" is
    expect(fixed[1].range.start.line).toBe(8);
    expect(fixed[1].range.start.character).toBe(5); // Position of "MyType" in "type MyType"
  });

  it("should not change positions for symbols not starting with comments", () => {
    const fileContent = `module TestModule

let directFunction x =
    x + 1

type DirectType = {
    Value: int
}`;

    const symbols: DocumentSymbol[] = [
      {
        name: "directFunction",
        kind: SymbolKind.Function,
        range: {
          start: { line: 2, character: 4 }, // Already correct
          end: { line: 3, character: 10 },
        },
        selectionRange: {
          start: { line: 2, character: 4 },
          end: { line: 2, character: 18 },
        },
      },
    ];

    const fixed = fixFSharpSymbolPositions(symbols, fileContent);

    // Should remain unchanged
    expect(fixed[0].range.start.line).toBe(2);
    expect(fixed[0].range.start.character).toBe(4);
  });

  it("should handle nested symbols with comments", () => {
    const fileContent = `module TestModule

/// Class comment
type MyClass() =
    /// Method comment
    member this.GetValue() = 42`;

    const symbols: DocumentSymbol[] = [
      {
        name: "MyClass",
        kind: SymbolKind.Class,
        range: {
          start: { line: 2, character: 0 }, // Points to comment
          end: { line: 5, character: 31 },
        },
        selectionRange: {
          start: { line: 2, character: 0 },
          end: { line: 2, character: 7 },
        },
        children: [
          {
            name: "GetValue",
            kind: SymbolKind.Method,
            range: {
              start: { line: 4, character: 4 }, // Points to comment
              end: { line: 5, character: 31 },
            },
            selectionRange: {
              start: { line: 4, character: 4 },
              end: { line: 4, character: 12 },
            },
          },
        ],
      },
    ];

    const fixed = fixFSharpSymbolPositions(symbols, fileContent);

    // MyClass should point to line 3 where "type MyClass" is
    expect(fixed[0].range.start.line).toBe(3);

    // GetValue should point to line 5 where "member this.GetValue" is
    expect(fixed[0].children![0].range.start.line).toBe(5);
  });
});
