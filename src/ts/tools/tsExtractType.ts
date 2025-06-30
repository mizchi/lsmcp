import { z } from "zod";
import type { ToolDef } from "../../mcp/_mcplib.ts";
import { commonSchemas } from "../../common/schemas.ts";
import { createLSPClient } from "../../lsp/lspClient.ts";
import { CodeAction, Range, WorkspaceEdit } from "vscode-languageserver-types";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { MCPToolError } from "../../common/mcpErrors.ts";

const schema = z.object({
  root: commonSchemas.root,
  filePath: commonSchemas.filePath,
  startLine: commonSchemas.line,
  endLine: commonSchemas.line.optional(),
  extractType: z.enum(["type", "interface"]).describe(
    "Extract as type alias or interface",
  ),
  typeName: z.string().describe("Name for the extracted type"),
});

export const extractTypeTool: ToolDef<typeof schema> = {
  name: "lsmcp_extract_type",
  description:
    "Extract selected type expression into a type alias or interface (TypeScript only)",
  schema,
  execute: async ({
    root,
    filePath,
    startLine,
    endLine,
    extractType,
    typeName,
  }) => {
    const client = await createLSPClient({
      rootPath: root,
      languageId: "typescript",
    });

    try {
      const absolutePath = join(root, filePath);
      const fileUri = `file://${absolutePath}`;
      const content = readFileSync(absolutePath, "utf-8");
      const lines = content.split("\n");

      // Find line numbers
      const start = typeof startLine === "string"
        ? lines.findIndex((l) => l.includes(startLine))
        : startLine - 1;
      const end = endLine
        ? (typeof endLine === "string"
          ? lines.findIndex((l) => l.includes(endLine))
          : endLine - 1)
        : start;

      if (start < 0 || end < 0) {
        throw new MCPToolError(
          "Could not find specified lines in file",
          "LINE_NOT_FOUND",
        );
      }

      // Open the document
      await client.openDocument(fileUri, "typescript", content);

      // Create range for the selection
      const range: Range = {
        start: { line: start, character: 0 },
        end: { line: end, character: lines[end].length },
      };

      // Request code actions for the range
      const codeActions = await client.getCodeActions(fileUri, range);

      if (!codeActions || codeActions.length === 0) {
        throw new MCPToolError(
          "No code actions available for this selection",
          "NO_CODE_ACTIONS",
          [
            "Ensure you've selected a valid type expression",
            "TypeScript Language Server must support extract type refactoring",
          ],
        );
      }

      // Find extract type/interface actions
      const extractActions = (codeActions as CodeAction[]).filter(
        (action: CodeAction) => {
          const title = action.title.toLowerCase();
          const isExtractType = extractType === "type" &&
            (title.includes("extract to type alias") ||
              title.includes("extract type"));
          const isExtractInterface = extractType === "interface" &&
            (title.includes("extract to interface") ||
              title.includes("extract interface"));
          return isExtractType || isExtractInterface;
        },
      );

      if (extractActions.length === 0) {
        throw new MCPToolError(
          `No ${extractType} extraction action available`,
          "EXTRACT_NOT_AVAILABLE",
          [
            "The selected code may not be a valid type expression",
            `Try extracting as ${
              extractType === "type" ? "interface" : "type"
            } instead`,
          ],
        );
      }

      // Apply the first matching action
      const action = extractActions[0] as CodeAction;
      let workspaceEdit: WorkspaceEdit | undefined;

      if (action.edit) {
        workspaceEdit = action.edit;
      } else if (action.command) {
        // Some servers return a command that needs to be executed
        throw new MCPToolError(
          "Server returned command instead of edit. Command execution not yet supported.",
          "COMMAND_NOT_SUPPORTED",
        );
      }

      if (!workspaceEdit) {
        throw new MCPToolError(
          "No workspace edit provided by the server",
          "NO_EDIT_PROVIDED",
        );
      }

      // Apply the workspace edit manually
      // Note: In a real implementation, we would need to handle the rename
      // of the extracted type to the user-provided typeName
      let changeCount = 0;
      for (
        const [uri, edits] of Object.entries(
          workspaceEdit.changes || {},
        )
      ) {
        const path = uri.replace("file://", "");
        let fileContent = readFileSync(path, "utf-8");

        // Sort edits by position (reverse order to apply from end to start)
        const sortedEdits = [...edits].sort((a, b) => {
          if (a.range.start.line !== b.range.start.line) {
            return b.range.start.line - a.range.start.line;
          }
          return b.range.start.character - a.range.start.character;
        });

        // Apply edits
        const lines = fileContent.split("\n");
        for (const edit of sortedEdits) {
          const startLine = edit.range.start.line;
          const endLine = edit.range.end.line;
          const startChar = edit.range.start.character;
          const endChar = edit.range.end.character;

          if (startLine === endLine) {
            // Single line edit
            lines[startLine] = lines[startLine].substring(0, startChar) +
              edit.newText +
              lines[startLine].substring(endChar);
          } else {
            // Multi-line edit
            const newLines = edit.newText.split("\n");
            const before = lines[startLine].substring(0, startChar);
            const after = lines[endLine].substring(endChar);
            lines.splice(
              startLine,
              endLine - startLine + 1,
              before + newLines[0],
              ...newLines.slice(1, -1),
              newLines[newLines.length - 1] + after,
            );
          }
          changeCount++;
        }

        // Write the file back
        writeFileSync(path, lines.join("\n"));
      }

      await client.stop();

      return `Successfully extracted ${extractType} "${typeName}"
Applied ${changeCount} changes to ${
        Object.keys(workspaceEdit.changes || {}).length
      } file(s)

Note: You may need to manually rename the extracted type to "${typeName}" if the server used a different name.`;
    } catch (error) {
      await client.stop();
      throw error;
    }
  },
};
