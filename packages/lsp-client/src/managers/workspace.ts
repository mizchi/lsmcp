/**
 * Workspace edit management
 */

import { fileURLToPath } from "url";
import type { WorkspaceEdit } from "../protocol/types/index.ts";
import type { ApplyWorkspaceEditResponse } from "../protocol/types/responses.ts";
import type { IFileSystem } from "../interfaces.ts";
import { applyTextEdits } from "../utils/textEdits.ts";
import type { DocumentManager } from "./document-manager.ts";

function toPath(uri: string): string {
  return uri.startsWith("file://") ? fileURLToPath(uri) : uri;
}

/**
 * Applies `edit.changes` to the files on disk and to the open documents. An
 * open document's edits are applied to the text the server was last given,
 * and its new text is sent as textDocument/didChange right after the file is
 * written. Every new text is computed before the first write. Failures are
 * returned.
 */
export async function applyWorkspaceEdit(
  edit: WorkspaceEdit,
  fileSystemApi: IFileSystem,
  documentManager: DocumentManager,
  sendNotification: (method: string, params: unknown) => void,
): Promise<ApplyWorkspaceEditResponse> {
  if ("documentChanges" in edit && edit.documentChanges !== undefined) {
    return {
      applied: false,
      failureReason: "documentChanges is not supported",
    };
  }
  try {
    const newContents: Array<[uri: string, content: string]> = [];
    for (const [uri, edits] of Object.entries(edit.changes ?? {})) {
      if (!edits || edits.length === 0) {
        continue;
      }
      const currentContent =
        documentManager.getDocumentText(uri) ??
        (await fileSystemApi.readFile(toPath(uri)));
      newContents.push([uri, applyTextEdits(currentContent, edits)]);
    }
    for (const [uri, content] of newContents) {
      await fileSystemApi.writeFile(toPath(uri), content);
      if (documentManager.isDocumentOpen(uri)) {
        documentManager.updateDocument(uri, content, sendNotification);
      }
    }
    return { applied: true };
  } catch (err) {
    return {
      applied: false,
      failureReason: err instanceof Error ? err.message : String(err),
    };
  }
}
