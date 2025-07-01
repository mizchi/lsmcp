import { z } from "zod";
import type { ToolDef } from "../../mcp/_mcplib.ts";
import { commonSchemas } from "../../common/schemas.ts";
import { createLSPClient } from "../../lsp/lspClient.ts";
import { CodeAction, Range, WorkspaceEdit } from "vscode-languageserver-types";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { MCPToolError } from "../../common/mcpErrors.ts";
import { spawn } from "child_process";
import { findTypescriptLanguageServer } from "../utils/findTypescriptLanguageServer.ts";

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
    const absolutePath = join(root, filePath);
    const fileUri = `file://${absolutePath}`;

    // Check if file exists before starting LSP
    let content: string;
    try {
      content = readFileSync(absolutePath, "utf-8");
    } catch (error: any) {
      if (error.code === "ENOENT") {
        throw new MCPToolError(
          `File not found: ${filePath}`,
          "FILE_NOT_FOUND",
          [
            "Check that the file path is correct",
            "Ensure the file exists in the project",
          ],
        );
      }
      throw error;
    }

    // Create a dedicated LSP client for this operation
    // Use the TypeScript Language Server path set by typescript-mcp.ts
    const tsServerPath = process.env.TYPESCRIPT_LANGUAGE_SERVER_PATH ||
      findTypescriptLanguageServer(root) ||
      process.env.LSP_COMMAND?.split(" ")[0] ||
      "typescript-language-server";
    const lspProcess = spawn(
      tsServerPath,
      ["--stdio"],
      {
        cwd: root,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    const client = createLSPClient({
      rootPath: root,
      process: lspProcess,
      languageId: "typescript",
    });

    try {
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

      try {
        // Start the client
        await client.start();

        // Open the document
        client.openDocument(fileUri, content, "typescript");

        // Wait for LSP to process the document
        await new Promise((resolve) => setTimeout(resolve, 1000));

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
          throw new MCPToolError(
            "No code actions available for this selection",
            "NO_CODE_ACTIONS",
            [
              "Ensure you've selected a valid type expression",
              "TypeScript Language Server must support extract type refactoring",
            ],
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

          throw new MCPToolError(
            `No ${extractType} extraction action available`,
            "EXTRACT_NOT_AVAILABLE",
            [
              "The selected code may not be a valid type expression",
              `Try extracting as ${
                extractType === "type" ? "interface" : "type"
              } instead`,
              "Ensure you've selected a complete type expression",
            ],
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

          throw new MCPToolError(
            "This TypeScript Language Server returns commands instead of direct edits. This is not yet fully supported.",
            "COMMAND_NOT_SUPPORTED",
            [
              "Try using a different TypeScript Language Server",
              "Or use manual extraction for now",
            ],
          );
        }

        if (!action.edit) {
          throw new MCPToolError(
            "No workspace edit provided by the server",
            "NO_EDIT_PROVIDED",
          );
        }

        // Apply the workspace edit manually
        const workspaceEdit = action.edit;
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

        return `Successfully extracted ${extractType} "${typeName}"
Applied ${changeCount} changes to ${
          Object.keys(workspaceEdit.changes || {}).length
        } file(s)

Note: You may need to manually rename the extracted type to "${typeName}" if the server used a different name.`;
      } finally {
        await client.stop();
      }
    } catch (error) {
      // Only try to kill the process if it was created
      try {
        if (lspProcess && !lspProcess.killed) {
          lspProcess.kill();
        }
      } catch (killError) {
        // Ignore errors during cleanup
      }
      throw error;
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
  return changeCount;
}
