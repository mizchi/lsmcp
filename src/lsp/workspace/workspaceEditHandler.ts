/**
 * Workspace edit handling for LSP
 */

import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import type {
  WorkspaceEdit,
  TextEdit,
  ApplyWorkspaceEditParams,
  ApplyWorkspaceEditResponse,
} from "../lspTypes.ts";
import { getErrorMessage } from "../../core/pure/types.ts";

/**
 * Apply a workspace edit manually (when server doesn't support workspace/applyEdit)
 */
export async function applyWorkspaceEditManually(
  edit: WorkspaceEdit,
): Promise<void> {
  if (!edit.changes) {
    return;
  }

  for (const [uri, edits] of Object.entries(edit.changes)) {
    try {
      // Convert file URI to path
      const filePath = fileURLToPath(uri);

      // Read current content
      const currentContent = await fs.readFile(filePath, "utf8");

      // Apply edits
      const newContent = applyTextEdits(currentContent, edits);

      // Write back
      await fs.writeFile(filePath, newContent, "utf8");
    } catch (error) {
      throw new Error(
        `Failed to apply edit to ${uri}: ${getErrorMessage(error)}`,
      );
    }
  }
}

/**
 * Apply text edits to a document
 */
function applyTextEdits(content: string, edits: TextEdit[]): string {
  // Sort edits by position (reverse order to apply from end to start)
  const sortedEdits = [...edits].sort((a, b) => {
    if (a.range.start.line !== b.range.start.line) {
      return b.range.start.line - a.range.start.line;
    }
    return b.range.start.character - a.range.start.character;
  });

  // Convert content to lines for easier manipulation
  const lines = content.split("\n");

  for (const edit of sortedEdits) {
    const { range, newText } = edit;

    // Handle single line edit
    if (range.start.line === range.end.line) {
      const line = lines[range.start.line];
      lines[range.start.line] =
        line.substring(0, range.start.character) +
        newText +
        line.substring(range.end.character);
    } else {
      // Multi-line edit
      const startLine = lines[range.start.line];
      const endLine = lines[range.end.line];

      const newLines = newText.split("\n");
      const firstNewLine =
        startLine.substring(0, range.start.character) + newLines[0];
      const lastNewLine =
        newLines[newLines.length - 1] + endLine.substring(range.end.character);

      const replacementLines = [
        firstNewLine,
        ...newLines.slice(1, -1),
        ...(newLines.length > 1 ? [lastNewLine] : []),
      ];

      // Replace the lines
      lines.splice(
        range.start.line,
        range.end.line - range.start.line + 1,
        ...replacementLines,
      );
    }
  }

  return lines.join("\n");
}

/**
 * Create workspace/applyEdit params
 */
export function createApplyWorkspaceEditParams(
  edit: WorkspaceEdit,
  label?: string,
): ApplyWorkspaceEditParams {
  return {
    label,
    edit,
  };
}

/**
 * Handle workspace/applyEdit response
 */
export function handleApplyWorkspaceEditResponse(
  response: ApplyWorkspaceEditResponse,
): void {
  if (!response.applied) {
    const reason = response.failureReason || "unknown reason";
    throw new Error(`Workspace edit was not applied: ${reason}`);
  }
}
