import { z } from "zod";
import type { ToolDef } from "../../mcp/utils/mcpHelpers.ts";
import { commonSchemas } from "../../core/pure/schemas.ts";
import { CodeAction, Range, WorkspaceEdit } from "vscode-languageserver-types";
import { readFileSync, writeFileSync } from "fs";
import { errors } from "../../core/pure/errors/index.ts";
import { readFileWithMetadata } from "../../core/io/fileOperations.ts";
import {
  createTypescriptLSPClient,
  openDocument,
  stopLSPClient,
  waitForLSP,
} from "../../core/io/lspClientFactory.ts";

const schema = z.object({
  root: commonSchemas.root,
  filePath: commonSchemas.filePath,
  startLine: commonSchemas.line,
  endLine: commonSchemas.line.optional(),
  extractType: z
    .enum(["type", "interface"])
    .describe("Extract as type alias or interface"),
  typeName: z.string().describe("Name for the extracted type"),
});

export const extractTypeTool: ToolDef<typeof schema> = {
  name: "extract_type",
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
    // Read file content with metadata
    const { fileContent: content, fileUri } = readFileWithMetadata(
      root,
      filePath,
    );

    // Create TypeScript LSP client
    const clientInstance = await createTypescriptLSPClient(root);
    const { client } = clientInstance;

    try {
      const lines = content.split("\n");

      // Find line numbers
      const start =
        typeof startLine === "string"
          ? lines.findIndex((l) => l.includes(startLine))
          : startLine - 1;
      const end = endLine
        ? typeof endLine === "string"
          ? lines.findIndex((l) => l.includes(endLine))
          : endLine - 1
        : start;

      if (start < 0 || end < 0) {
        throw errors.lineNotFound(startLine, filePath);
      }

      // Open the document
      openDocument(client, fileUri, content);

      // Wait for LSP to process the document
      await waitForLSP();

      // Find the actual type expression in the line
      let startChar = 0;
      let endChar = lines[end].length;

      // If searching by string, find the exact position
      if (typeof startLine === "string") {
        const searchStr = startLine;
        const lineContent = lines[start];
        const pos = lineContent.indexOf(searchStr);
        if (pos >= 0) {
          startChar = pos;
          endChar = pos + searchStr.length;
        }
      }

      // Create range for the selection
      const range: Range = {
        start: { line: start, character: startChar },
        end: { line: end, character: endChar },
      };

      // Request code actions for the range
      const codeActions = await client.getCodeActions(fileUri, range);

      if (!codeActions || codeActions.length === 0) {
        throw errors.generic(
          "No code actions available for this selection",
          undefined,
          {
            operation: "extract_type",
            filePath,
            line: startLine,
          },
        );
      }

      // Debug: Log available code actions
      console.error(
        "Available code actions:",
        codeActions.map((action: any) => ({
          title: action.title,
          kind: action.kind,
          command: action.command,
          edit: action.edit ? "has edit" : "no edit",
        })),
      );

      // Find extract type/interface actions
      const extractActions = (codeActions as CodeAction[]).filter(
        (action: CodeAction) => {
          const title = action.title.toLowerCase();
          const isExtractType =
            extractType === "type" &&
            (title.includes("extract to type alias") ||
              title.includes("extract type"));
          const isExtractInterface =
            extractType === "interface" &&
            (title.includes("extract to interface") ||
              title.includes("extract interface"));
          return isExtractType || isExtractInterface;
        },
      );

      if (extractActions.length === 0) {
        // If no exact match, look for any extract actions
        const anyExtractActions = (codeActions as CodeAction[]).filter(
          (action: CodeAction) => {
            const title = action.title.toLowerCase();
            return title.includes("extract");
          },
        );

        if (anyExtractActions.length > 0) {
          console.error(
            "Found extract actions but not the requested type:",
            anyExtractActions.map((a) => a.title),
          );
        }

        throw errors.generic(
          `No ${extractType} extraction action available`,
          undefined,
          {
            operation: "extract_type",
            filePath,
            line: startLine,
          },
        );
      }

      // Apply the first matching action
      const action = extractActions[0] as CodeAction;

      // If the action has a command, we need to execute it
      if (action.command && !action.edit) {
        // TypeScript Language Server returns actions with commands
        // We need to execute the command to get the workspace edit
        console.error("Action has command:", action.command);

        // Try to execute the command if it's a known refactoring command
        if (action.command.command === "_typescript.applyRefactoring") {
          const args = action.command.arguments;
          if (args && args.length > 0) {
            try {
              // Send the apply refactoring request
              const result = await client.sendRequest<WorkspaceEdit>(
                "workspace/executeCommand",
                {
                  command: action.command.command,
                  arguments: args,
                },
              );

              if (result && result.changes) {
                // Apply the workspace edit
                await applyWorkspaceEdit(result, typeName);
                return `Successfully extracted ${extractType} "${typeName}"`;
              }
            } catch (err) {
              console.error("Failed to execute command:", err);
            }
          }
        }

        throw errors.operationNotSupported(
          "extract_type_command",
          "typescript",
          {
            operation: "extract_type",
            filePath,
          },
        );
      }

      if (!action.edit) {
        throw errors.generic(
          "No workspace edit provided by the server",
          undefined,
          {
            operation: "extract_type",
            filePath,
          },
        );
      }

      // Apply the workspace edit manually
      const workspaceEdit = action.edit;
      let changeCount = 0;
      for (const [uri, edits] of Object.entries(workspaceEdit.changes || {})) {
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
            lines[startLine] =
              lines[startLine].substring(0, startChar) +
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

      return `Successfully extracted ${extractType} "${typeName}"
Applied ${changeCount} changes to ${
        Object.keys(workspaceEdit.changes || {}).length
      } file(s)

Note: You may need to manually rename the extracted type to "${typeName}" if the server used a different name.`;
    } finally {
      await stopLSPClient(clientInstance);
    }
  },
};

// Helper function to apply workspace edit
async function applyWorkspaceEdit(
  workspaceEdit: WorkspaceEdit,
  _typeName: string,
) {
  let changeCount = 0;
  for (const [uri, edits] of Object.entries(workspaceEdit.changes || {})) {
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
        lines[startLine] =
          lines[startLine].substring(0, startChar) +
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
  return changeCount;
}
