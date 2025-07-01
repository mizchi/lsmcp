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

      try {
        // Start the client
        await client.start();

        // Open the document
        client.openDocument(fileUri, content, "typescript");

        // Wait for LSP to process the document
        await new Promise((resolve) => setTimeout(resolve, 1000));

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

        // If no standard code actions, try TypeScript-specific refactoring
        if (!codeActions || codeActions.length === 0) {
          // Try to get applicable refactors using TypeScript's protocol
          const refactorResponse = await client.sendRequest<any>(
            "typescript/getApplicableRefactors",
            {
              file: absolutePath,
              startLine: lineIndex + 1,
              startOffset: propertyIndex + 1,
              endLine: lineIndex + 1,
              endOffset: propertyIndex + propertyName.length + 1,
            },
          );

          if (refactorResponse && refactorResponse.length > 0) {
            // Find generate accessors refactoring
            for (const refactor of refactorResponse) {
              const action = refactor.actions?.find((a: any) => {
                const name = a.name.toLowerCase();
                return name.includes("generate") &&
                  (name.includes("get") || name.includes("set") ||
                    name.includes("accessor"));
              });

              if (action) {
                // Get edits for this refactor
                const editsResponse = await client.sendRequest<any>(
                  "typescript/getEditsForRefactor",
                  {
                    file: absolutePath,
                    startLine: lineIndex + 1,
                    startOffset: propertyIndex + 1,
                    endLine: lineIndex + 1,
                    endOffset: propertyIndex + propertyName.length + 1,
                    refactor: refactor.name,
                    action: action.name,
                  },
                );

                if (editsResponse && editsResponse.edits) {
                  // Apply the edits
                  let changeCount = 0;
                  for (const fileEdit of editsResponse.edits) {
                    const editPath = fileEdit.fileName;
                    let fileContent = readFileSync(editPath, "utf-8");
                    const lines = fileContent.split("\n");

                    // Sort text changes by position (reverse order)
                    const sortedChanges = [...(fileEdit.textChanges || [])]
                      .sort((a, b) => {
                        return b.start.offset - a.start.offset;
                      });

                    for (const change of sortedChanges) {
                      const startPos = change.start;
                      const endPos = change.end;

                      // Convert offset to line/character
                      let currentOffset = 0;
                      let startLine = 0;
                      let startChar = 0;
                      let endLine = 0;
                      let endChar = 0;

                      for (let i = 0; i < lines.length; i++) {
                        const lineLength = lines[i].length + 1; // +1 for newline
                        if (
                          currentOffset + lineLength > startPos.offset &&
                          startLine === 0
                        ) {
                          startLine = i;
                          startChar = startPos.offset - currentOffset;
                        }
                        if (
                          currentOffset + lineLength > endPos.offset &&
                          endLine === 0
                        ) {
                          endLine = i;
                          endChar = endPos.offset - currentOffset;
                          break;
                        }
                        currentOffset += lineLength;
                      }

                      // Apply the change
                      if (startLine === endLine) {
                        lines[startLine] =
                          lines[startLine].substring(0, startChar) +
                          change.newText +
                          lines[startLine].substring(endChar);
                      } else {
                        const newLines = change.newText.split("\n");
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

                    writeFileSync(editPath, lines.join("\n"));
                  }

                  await client.stop();
                  return `Successfully generated get/set accessors for property "${propertyName}"
Applied ${changeCount} changes

The property has been converted to use accessor methods.`;
                }
              }
            }
          }
        }

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

        // Find generate accessor actions
        const accessorActions = (codeActions as CodeAction[]).filter(
          (action: CodeAction) => {
            const title = action.title.toLowerCase();
            return title.includes("generate") &&
              (title.includes("get") ||
                title.includes("set") ||
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
        let changeCount = 0;
        let modifiedFiles: string[] = [];
        for (
          const [uri, edits] of Object.entries(
            workspaceEdit.changes || {},
          )
        ) {
          const path = uri.replace("file://", "");
          let fileContent = readFileSync(path, "utf-8");
          modifiedFiles.push(path);

          // Sort edits by position (reverse order to apply from end to start)
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
              // Single line edit
              fileLines[startLine] =
                fileLines[startLine].substring(0, startChar) +
                edit.newText +
                fileLines[startLine].substring(endChar);
            } else {
              // Multi-line edit
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

        return `Successfully generated get/set accessors for property "${propertyName}"
Applied ${changeCount} changes to ${modifiedFiles.length} file(s)

The property has been converted to use accessor methods. The original property is now private with generated getter and setter methods.`;
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
