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
  line: commonSchemas.line,
  propertyName: z.string().describe(
    "Name of the property to generate accessors for",
  ),
});

export const generateAccessorsTool: ToolDef<typeof schema> = {
  name: "lsmcp_generate_accessors",
  description:
    "Generate get/set accessor methods for a class property (TypeScript only)",
  schema,
  execute: async ({ root, filePath, line, propertyName }) => {
    const client = await createLSPClient({
      rootPath: root,
      languageId: "typescript",
    });

    try {
      const absolutePath = join(root, filePath);
      const fileUri = `file://${absolutePath}`;
      const content = readFileSync(absolutePath, "utf-8");
      const lines = content.split("\n");

      // Find line number
      const lineIndex = typeof line === "string"
        ? lines.findIndex((l) => l.includes(line))
        : line - 1;

      if (lineIndex < 0) {
        throw new MCPToolError(
          "Could not find specified line in file",
          "LINE_NOT_FOUND",
        );
      }

      // Find the property name position in the line
      const lineContent = lines[lineIndex];
      const propertyIndex = lineContent.indexOf(propertyName);

      if (propertyIndex < 0) {
        throw new MCPToolError(
          `Property "${propertyName}" not found on the specified line`,
          "PROPERTY_NOT_FOUND",
        );
      }

      // Open the document
      await client.openDocument(fileUri, "typescript", content);

      // Create range for the property
      const range: Range = {
        start: { line: lineIndex, character: propertyIndex },
        end: {
          line: lineIndex,
          character: propertyIndex + propertyName.length,
        },
      };

      // Request code actions for the property
      const codeActions = await client.getCodeActions(fileUri, range);

      if (!codeActions || codeActions.length === 0) {
        throw new MCPToolError(
          "No code actions available for this property",
          "NO_CODE_ACTIONS",
          [
            "Ensure the property is a class member",
            "The property must be in a TypeScript class",
          ],
        );
      }

      // Find generate get/set accessor actions
      const accessorActions = (codeActions as CodeAction[]).filter(
        (action: CodeAction) => {
          const title = action.title.toLowerCase();
          return title.includes("generate") &&
            (title.includes("get") || title.includes("set") ||
              title.includes("accessor"));
        },
      );

      if (accessorActions.length === 0) {
        throw new MCPToolError(
          "No generate accessor action available",
          "ACCESSORS_NOT_AVAILABLE",
          [
            "The selected property may already have accessors",
            "Ensure this is a simple property declaration",
          ],
        );
      }

      // Apply the first matching action
      const action = accessorActions[0] as CodeAction;
      let workspaceEdit: WorkspaceEdit | undefined;

      if (action.edit) {
        workspaceEdit = action.edit;
      } else if (action.command) {
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

      // Apply the workspace edit
      let changeCount = 0;
      let modifiedFiles: string[] = [];

      for (const [uri, edits] of Object.entries(workspaceEdit.changes || {})) {
        const path = uri.replace("file://", "");
        let fileContent = readFileSync(path, "utf-8");
        modifiedFiles.push(path);

        // Sort edits by position (reverse order)
        const sortedEdits = [...edits].sort((a, b) => {
          if (a.range.start.line !== b.range.start.line) {
            return b.range.start.line - a.range.start.line;
          }
          return b.range.start.character - a.range.start.character;
        });

        // Apply edits
        const fileLines = fileContent.split("\n");
        for (const edit of sortedEdits) {
          const startLine = edit.range.start.line;
          const endLine = edit.range.end.line;
          const startChar = edit.range.start.character;
          const endChar = edit.range.end.character;

          if (startLine === endLine) {
            fileLines[startLine] =
              fileLines[startLine].substring(0, startChar) +
              edit.newText +
              fileLines[startLine].substring(endChar);
          } else {
            const newLines = edit.newText.split("\n");
            const before = fileLines[startLine].substring(0, startChar);
            const after = fileLines[endLine].substring(endChar);
            fileLines.splice(
              startLine,
              endLine - startLine + 1,
              before + newLines[0],
              ...newLines.slice(1, -1),
              newLines[newLines.length - 1] + after,
            );
          }
          changeCount++;
        }

        writeFileSync(path, fileLines.join("\n"));
      }

      await client.stop();

      return `Successfully generated get/set accessors for property "${propertyName}"
Applied ${changeCount} changes to ${modifiedFiles.length} file(s)

The property has been converted to use accessor methods. The original property is now private with generated getter and setter methods.`;
    } catch (error) {
      await client.stop();
      throw error;
    }
  },
};
