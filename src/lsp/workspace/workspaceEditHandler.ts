/**
 * Workspace edit handling for LSP
 */

import { fileURLToPath } from "url";
import type {
  WorkspaceEdit,
  ApplyWorkspaceEditParams,
  ApplyWorkspaceEditResponse,
} from "../lspTypes.ts";
import { getErrorMessage } from "../../shared/types/types.ts";
import type { FileSystemApi } from "../../filesystem/api/FileSystemApi.ts";
import { nodeFileSystemApi } from "../../filesystem/node/NodeFileSystemApi.ts";
import { applyTextEdits } from "../../shared/text/applyTextEdits.ts";

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
