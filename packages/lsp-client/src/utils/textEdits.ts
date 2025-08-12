/**
 * Text edit utilities
 */

import type { TextEdit, Position } from "../protocol/types/index.ts";

export function applyTextEdits(text: string, edits: TextEdit[]): string {
  // Sort edits in reverse order (from end to start) to avoid position shifts
  const sortedEdits = [...edits].sort((a, b) => {
    if (a.range.start.line !== b.range.start.line) {
      return b.range.start.line - a.range.start.line;
    }
    return b.range.start.character - a.range.start.character;
  });

  let lines = text.split("\n");

  for (const edit of sortedEdits) {
    const startLine = edit.range.start.line;
    const startChar = edit.range.start.character;
    const endLine = edit.range.end.line;
    const endChar = edit.range.end.character;

    // Get the text before and after the edit range
    const beforeEdit =
      lines[startLine].substring(0, startChar) +
      edit.newText +
      lines[endLine].substring(endChar);

    // Remove the lines in the range and replace with the new text
    const removedLines = endLine - startLine;
    lines.splice(startLine, removedLines + 1, ...beforeEdit.split("\n"));
  }

  return lines.join("\n");
}

export function positionToOffset(text: string, position: Position): number {
  const lines = text.split("\n");
  let offset = 0;

  for (let i = 0; i < position.line && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }

  if (position.line < lines.length) {
    offset += Math.min(position.character, lines[position.line].length);
  }

  return offset;
}

export function offsetToPosition(text: string, offset: number): Position {
  const lines = text.split("\n");
  let currentOffset = 0;
  let line = 0;

  while (
    line < lines.length &&
    currentOffset + lines[line].length + 1 <= offset
  ) {
    currentOffset += lines[line].length + 1;
    line++;
  }

  return {
    line,
    character: offset - currentOffset,
  };
}
