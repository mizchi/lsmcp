/**
 * F# position fix for fsautocomplete
 *
 * fsautocomplete sometimes returns symbol positions that point to document comments
 * instead of the actual symbol declaration. This module provides utilities to fix
 * these positions.
 */

import type { DocumentSymbol, Range } from "vscode-languageserver-types";

/**
 * Fix F# symbol positions that point to comments
 *
 * @param symbols The symbols returned by fsautocomplete
 * @param fileContent The content of the file
 * @returns Symbols with corrected positions
 */
export function fixFSharpSymbolPositions(
  symbols: DocumentSymbol[],
  fileContent: string,
): DocumentSymbol[] {
  const lines = fileContent.split("\n");

  return symbols.map((symbol) => fixSymbol(symbol, lines));
}

function fixSymbol(symbol: DocumentSymbol, lines: string[]): DocumentSymbol {
  // Fix the symbol's range
  const fixedRange = fixRange(
    symbol.range,
    symbol.selectionRange,
    lines,
    symbol.name,
  );

  // Recursively fix children
  const fixedChildren = symbol.children?.map((child) =>
    fixSymbol(child, lines),
  );

  return {
    ...symbol,
    range: fixedRange.range,
    selectionRange: fixedRange.selectionRange,
    children: fixedChildren,
  };
}

function fixRange(
  range: Range,
  selectionRange: Range,
  lines: string[],
  symbolName: string,
): { range: Range; selectionRange: Range } {
  // Check if the current line is a comment
  const startLine = range.start.line;

  if (startLine >= lines.length) {
    // Invalid line number, return as-is
    return { range, selectionRange };
  }

  const currentLine = lines[startLine].trim();

  // Check if current line is a comment (F# uses /// for doc comments)
  if (currentLine.startsWith("///") || currentLine.startsWith("//")) {
    // Search forward for the actual symbol declaration
    for (
      let i = startLine + 1;
      i < Math.min(startLine + 10, lines.length);
      i++
    ) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (
        trimmedLine === "" ||
        trimmedLine.startsWith("///") ||
        trimmedLine.startsWith("//")
      ) {
        continue;
      }

      // Check if this line contains the symbol declaration
      // F# declarations typically start with: let, type, member, val, module, namespace
      // For record fields, look for "FieldName:" pattern
      const isRecordField = trimmedLine.includes(`${symbolName}:`) && 
                           !trimmedLine.startsWith("///") && 
                           !trimmedLine.startsWith("//");
      
      if (
        isRecordField ||
        trimmedLine.startsWith("let ") ||
        trimmedLine.startsWith("type ") ||
        trimmedLine.startsWith("member ") ||
        trimmedLine.startsWith("val ") ||
        trimmedLine.startsWith("module ") ||
        trimmedLine.startsWith("namespace ") ||
        trimmedLine.includes(`let ${symbolName}`) ||
        trimmedLine.includes(`type ${symbolName}`) ||
        trimmedLine.includes(`member this.${symbolName}`) ||
        trimmedLine.includes(`member self.${symbolName}`) ||
        trimmedLine.includes(`member _.${symbolName}`)
      ) {
        // Found the actual declaration, update the position
        const charPos = line.indexOf(symbolName);
        const newStart = {
          line: i,
          character: charPos >= 0 ? charPos : 0,
        };

        // Adjust the range
        const lineDiff = i - startLine;
        return {
          range: {
            start: newStart,
            end: {
              line: range.end.line + lineDiff,
              character: range.end.character,
            },
          },
          selectionRange: {
            start: newStart,
            end: {
              line: selectionRange.end.line + lineDiff,
              character: selectionRange.end.character,
            },
          },
        };
      }
    }
  }

  // No fix needed or couldn't find the actual declaration
  return { range, selectionRange };
}
