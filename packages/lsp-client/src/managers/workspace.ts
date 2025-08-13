/**
 * Workspace edit management
 */

import type { WorkspaceEdit } from "../protocol/types/index.ts";
import type { IFileSystem } from "../interfaces.ts";
import { applyTextEdits } from "../utils/textEdits.ts";

export async function applyWorkspaceEditManually(
  edit: WorkspaceEdit,
  fileSystemApi: IFileSystem,
): Promise<void> {
  if (!edit.changes) {
    return;
  }

  for (const [uri, edits] of Object.entries(edit.changes)) {
    if (!edits || edits.length === 0) {
      continue;
    }

    // Convert file:// URI to file path
    const filePath = uri.startsWith("file://") ? uri.slice(7) : uri;

    // Read current content
    const currentContent = await fileSystemApi.readFile(filePath, "utf8");

    // Apply edits
    const newContent = applyTextEdits(currentContent, edits);

    // Write back
    await fileSystemApi.writeFile(filePath, newContent);
  }
}

export function createApplyWorkspaceEditParams(
  edit: WorkspaceEdit,
  label?: string,
): { edit: WorkspaceEdit; label?: string } {
  return { edit, label };
}

export function handleApplyWorkspaceEditResponse(response: unknown): {
  applied: boolean;
  failureReason?: string;
} {
  if (!response || typeof response !== "object") {
    return { applied: false, failureReason: "Invalid response from server" };
  }

  const result = response as { applied?: boolean; failureReason?: string };
  return {
    applied: result.applied ?? false,
    failureReason: result.failureReason,
  };
}
