/**
 * Workspace edit handling for LSP
 */

import { fileURLToPath } from "url";
import type {
  WorkspaceEdit,
  ApplyWorkspaceEditParams,
  ApplyWorkspaceEditResponse,
} from "../lspTypes.ts";
import { getErrorMessage } from "./utils/errors.ts";
import type { FileSystemApi } from "./utils/container-helpers.ts";
import { nodeFileSystemApi } from "./utils/container-helpers.ts";
import type { TextEdit } from "../lspTypes.ts";

// Simple implementation of applyTextEdits
function applyTextEdits(content: string, edits: TextEdit[]): string {
  const lines = content.split("\n");

  // Sort edits in reverse order to apply from bottom to top
  const sortedEdits = [...edits].sort((a, b) => {
    if (a.range.start.line !== b.range.start.line) {
      return b.range.start.line - a.range.start.line;
    }
    return b.range.start.character - a.range.start.character;
  });

  for (const edit of sortedEdits) {
    const startLine = edit.range.start.line;
    const endLine = edit.range.end.line;
    const startChar = edit.range.start.character;
    const endChar = edit.range.end.character;

    if (startLine === endLine) {
      // Single line edit
      const line = lines[startLine] || "";
      lines[startLine] =
        line.substring(0, startChar) + edit.newText + line.substring(endChar);
    } else {
      // Multi-line edit
      const startLineText = lines[startLine] || "";
      const endLineText = lines[endLine] || "";
      const newLineText =
        startLineText.substring(0, startChar) +
        edit.newText +
        endLineText.substring(endChar);
      lines.splice(startLine, endLine - startLine + 1, newLineText);
    }
  }

  return lines.join("\n");
}

/**
 * Apply a workspace edit manually (when server doesn't support workspace/applyEdit)
 */
export async function applyWorkspaceEditManually(
  edit: WorkspaceEdit,
  fs: FileSystemApi = nodeFileSystemApi,
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
