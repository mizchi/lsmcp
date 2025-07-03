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
import { validateLineAndSymbol } from "../../core/pure/validation.ts";

const schema = z.object({
  root: commonSchemas.root,
  filePath: commonSchemas.filePath,
  line: commonSchemas.line,
  propertyName: z
    .string()
    .describe("Name of the property to generate accessors for"),
});

export const generateAccessorsTool: ToolDef<typeof schema> = {
  name: "generate_accessors",
  description:
    "Generate get/set accessor methods for a class property (TypeScript only)",
  schema,
  execute: async ({ root, filePath, line, propertyName }) => {
    // Read file content with metadata
    const {
      absolutePath,
      fileContent: content,
      fileUri,
    } = readFileWithMetadata(root, filePath);

    // Create TypeScript LSP client
    const clientInstance = await createTypescriptLSPClient(root);
    const { client } = clientInstance;

    try {
      // Validate line and symbol
      const { lineIndex, symbolIndex: propertyIndex } = validateLineAndSymbol(
        content,
        line,
        propertyName,
        filePath,
      );

      // Open the document
      openDocument(client, fileUri, content);

      // Wait for LSP to process the document
      await waitForLSP();

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
              return (
                name.includes("generate") &&
                (name.includes("get") ||
                  name.includes("set") ||
                  name.includes("accessor"))
              );
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
                  const sortedChanges = [...(fileEdit.textChanges || [])].sort(
                    (a, b) => {
                      return b.start.offset - a.start.offset;
                    },
                  );

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

                await stopLSPClient(clientInstance);
                return `Successfully generated get/set accessors for property "${propertyName}"
Applied ${changeCount} changes

The property has been converted to use accessor methods.`;
              }
            }
          }
        }
      }

      if (!codeActions || codeActions.length === 0) {
        throw errors.generic(
          "No code actions available for this property",
          undefined,
          {
            operation: "generate_accessors",
            filePath,
            symbolName: propertyName,
            line,
          },
        );
      }

      // Find generate accessor actions
      const accessorActions = (codeActions as CodeAction[]).filter(
        (action: CodeAction) => {
          const title = action.title.toLowerCase();
          return (
            title.includes("generate") &&
            (title.includes("get") ||
              title.includes("set") ||
              title.includes("accessor"))
          );
        },
      );

      if (accessorActions.length === 0) {
        throw errors.generic(
          "No generate accessor action available",
          undefined,
          {
            operation: "generate_accessors",
            filePath,
            symbolName: propertyName,
            line,
          },
        );
      }

      // Apply the first matching action
      const action = accessorActions[0] as CodeAction;
      let workspaceEdit: WorkspaceEdit | undefined;

      if (action.edit) {
        workspaceEdit = action.edit;
      } else if (action.command) {
        // Some servers return a command that needs to be executed
        throw errors.operationNotSupported(
          "generate_accessors_command",
          "typescript",
          {
            operation: "generate_accessors",
            filePath,
          },
        );
      }

      if (!workspaceEdit) {
        throw errors.generic(
          "No workspace edit provided by the server",
          undefined,
          {
            operation: "generate_accessors",
            filePath,
          },
        );
      }

      // Apply the workspace edit manually
      let changeCount = 0;
      let modifiedFiles: string[] = [];
      for (const [uri, edits] of Object.entries(workspaceEdit.changes || {})) {
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
      await stopLSPClient(clientInstance);
    }
  },
};
