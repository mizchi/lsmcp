/**
 * Workspace edit handling for LSP
 */

import { fileURLToPath } from "url";
import type {
  WorkspaceEdit,
  ApplyWorkspaceEditParams,
  ApplyWorkspaceEditResponse,
  TextEdit,
} from "../protocol/types-legacy.ts";
import { getErrorMessage } from "@lsmcp/types";
import type { FileSystemApi } from "../utils/container-helpers.ts";
import { nodeFileSystemApi } from "../utils/container-helpers.ts";
import { applyTextEdits } from "../utils/textEdits.ts";

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
      const newContent = applyTextEdits(currentContent, edits as TextEdit[]);

      // Write back
      await fs.writeFile(filePath, newContent);
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
