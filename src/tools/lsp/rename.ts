import type { LSPClient } from "@lsmcp/lsp-client";
import { z } from "zod";
import { err, ok, type Result } from "neverthrow";
import { applyTextEdits } from "../../shared/text/applyTextEdits.ts";
// Helper functions
function parseLineNumber(content: string, line: number | string): number {
  if (typeof line === "number") {
    return line - 1;
  }
  const lines = content.split("\n");
  const index = lines.findIndex((l) => l.includes(line));
  if (index === -1) {
    throw new Error(`Line containing "${line}" not found`);
  }
  return index;
}

function findSymbolInLine(
  lineContent: string,
  symbolName: string,
  occurrence = 0,
): number {
  let index = -1;
  for (let i = 0; i <= occurrence; i++) {
    index = lineContent.indexOf(symbolName, index + 1);
    if (index === -1) {
      throw new Error(`Symbol "${symbolName}" not found`);
    }
  }
  return index;
}

function findTargetInFile(
  content: string,
  target: string,
): { line: number; character: number } {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const index = lines[i].indexOf(target);
    if (index !== -1) {
      return { line: i, character: index };
    }
  }
  throw new Error(`Target "${target}" not found in file`);
}

import type { McpToolDef } from "@lsmcp/types";
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import path from "path";
import { Position, TextEdit, WorkspaceEdit } from "@lsmcp/types";
import { debug } from "@lsmcp/lsp-client";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line")
    .optional(),
  target: z.string().describe("Symbol to rename"),
  newName: z.string().describe("New name for the symbol"),
});

type RenameSymbolRequest = z.infer<typeof schema>;

interface RenameSymbolSuccess {
  message: string;
  changedFiles: {
    filePath: string;
    changes: {
      line: number;
      column: number;
      oldText: string;
      newText: string;
    }[];
  }[];
}

/**
 * Helper to handle rename request when line is not provided
 */
async function performRenameWithoutLine(
  request: RenameSymbolRequest,
  client: LSPClient,
): Promise<Result<RenameSymbolSuccess, string>> {
  try {
    // Read file content
    const absolutePath = path.resolve(request.root, request.filePath);
    const fileContent = readFileSync(absolutePath, "utf-8");
    const fileUri = `file://${absolutePath}`;
    // const lines = fileContent.split("\n");  // Currently unused

    // Find target text in file
    const targetResult = findTargetInFile(fileContent, request.target);
    const targetLine = targetResult.line;
    const symbolPosition = targetResult.character;

    return performRenameAtPosition(
      request,
      fileUri,
      fileContent,
      targetLine,
      symbolPosition,
      client,
    );
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Handle rename request when line is provided
 */
async function performRenameWithLine(
  request: RenameSymbolRequest,
  client: LSPClient,
): Promise<Result<RenameSymbolSuccess, string>> {
  try {
    // Read file content
    const absolutePath = path.resolve(request.root, request.filePath);
    const fileContent = readFileSync(absolutePath, "utf-8");
    const fileUri = `file://${absolutePath}`;

    // Parse line parameter
    const targetLine = parseLineNumber(fileContent, request.line!);
    const lines = fileContent.split("\n");
    const lineText = lines[targetLine] || "";

    // Find symbol position in line
    const symbolPosition = findSymbolInLine(lineText, request.target);

    return performRenameAtPosition(
      request,
      fileUri,
      fileContent,
      targetLine,
      symbolPosition,
      client,
    );
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Perform rename at a specific position
 */
async function performRenameAtPosition(
  request: RenameSymbolRequest,
  fileUri: string,
  fileContent: string,
  targetLine: number,
  symbolPosition: number,
  client: LSPClient,
): Promise<Result<RenameSymbolSuccess, string>> {
  try {
    if (!client) {
      return err("LSP client not available");
    }

    // Open all TypeScript/JavaScript files in the project to ensure LSP knows about them
    const projectFiles = await findProjectFiles(request.root);
    for (const file of projectFiles) {
      if (file !== path.resolve(request.root, request.filePath)) {
        try {
          const content = readFileSync(file, "utf-8");
          client.openDocument(`file://${file}`, content);
        } catch (e) {
          debug(`[lspRenameSymbol] Failed to open file: ${file}`, e);
        }
      }
    }

    // Open the target document
    client.openDocument(fileUri, fileContent);
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));

    const position: Position = {
      line: targetLine,
      character: symbolPosition,
    };

    // Optional: Check if rename is possible at this position
    try {
      const prepareResult = await client.prepareRename(fileUri, position);

      if (prepareResult === null) {
        return err(
          `Cannot rename symbol at line ${targetLine + 1}, column ${
            symbolPosition + 1
          }`,
        );
      }
    } catch {
      // Some LSP servers don't support prepareRename, continue with rename
    }

    // Perform rename
    let workspaceEdit: WorkspaceEdit | null = null;

    try {
      // Use the client's rename method which handles errors properly
      workspaceEdit = await client.rename(fileUri, position, request.newName);
    } catch (error: any) {
      // Check if LSP doesn't support rename (e.g., TypeScript Native Preview)
      if (
        error.code === -32601 ||
        error.message?.includes("Unhandled method") ||
        error.message?.includes("Method not found")
      ) {
        return err("LSP server doesn't support rename operation");
      }
      // Re-throw other errors
      throw error;
    }

    if (!workspaceEdit) {
      // LSP returned null, try TypeScript tool as fallback
      return err("No changes from LSP rename operation");
    }

    // Debug: Log the workspace edit
    debug(
      "[lspRenameSymbol] WorkspaceEdit from LSP:",
      JSON.stringify(workspaceEdit, null, 2),
    );

    // Apply changes and format result
    const result = await applyWorkspaceEdit(request.root, workspaceEdit);

    // Close all opened documents
    client.closeDocument(fileUri);
    for (const file of projectFiles) {
      if (file !== path.resolve(request.root, request.filePath)) {
        try {
          client.closeDocument(`file://${file}`);
        } catch (e) {
          // Ignore close errors
        }
      }
    }

    return ok(result);
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Apply workspace edit and return formatted result
 */
async function applyWorkspaceEdit(
  _root: string,
  workspaceEdit: WorkspaceEdit,
): Promise<RenameSymbolSuccess> {
  const changedFiles: RenameSymbolSuccess["changedFiles"] = [];
  const allFileContents = new Map<string, string[]>();

  // Collect all file contents before applying changes
  if (workspaceEdit.changes) {
    for (const [uri, _edits] of Object.entries(workspaceEdit.changes)) {
      if (!uri) continue;
      const filePath = uri.replace("file://", "");
      const content = readFileSync(filePath, "utf-8");
      allFileContents.set(filePath, content.split("\n"));
    }
  }

  if (workspaceEdit.documentChanges) {
    for (const change of workspaceEdit.documentChanges) {
      if ("textDocument" in change && change.textDocument?.uri) {
        const filePath = change.textDocument.uri.replace("file://", "");
        if (!allFileContents.has(filePath)) {
          const content = readFileSync(filePath, "utf-8");
          allFileContents.set(filePath, content.split("\n"));
        }
      }
    }
  }

  // Process changes from WorkspaceEdit.changes
  if (workspaceEdit.changes) {
    for (const [uri, edits] of Object.entries(workspaceEdit.changes)) {
      if (!uri) continue;
      const filePath = uri.replace("file://", "");
      const lines = allFileContents.get(filePath);
      if (!lines) continue;
      const fileChanges = processTextEdits(filePath, lines, edits);

      if (fileChanges.changes.length > 0) {
        changedFiles.push(fileChanges);

        // Apply edits to file
        const newContent = applyTextEdits(lines.join("\n"), edits);
        writeFileSync(filePath, newContent, "utf-8");
      }
    }
  }

  // Process changes from WorkspaceEdit.documentChanges
  if (workspaceEdit.documentChanges) {
    for (const change of workspaceEdit.documentChanges) {
      if (
        "textDocument" in change &&
        "edits" in change &&
        change.textDocument?.uri
      ) {
        const filePath = change.textDocument.uri.replace("file://", "");
        const lines = allFileContents.get(filePath);
        if (!lines) continue;
        const fileChanges = processTextEdits(filePath, lines, change.edits);

        if (fileChanges.changes.length > 0) {
          // Check if we already processed this file
          const existingFile = changedFiles.find(
            (f) => f.filePath === filePath,
          );
          if (existingFile) {
            existingFile.changes.push(...fileChanges.changes);
          } else {
            changedFiles.push(fileChanges);
          }

          // Apply edits to file
          const newContent = applyTextEdits(lines.join("\n"), change.edits);
          writeFileSync(filePath, newContent, "utf-8");
        }
      }
    }
  }

  const totalChanges = changedFiles.reduce(
    (sum, file) => sum + file.changes.length,
    0,
  );

  return {
    message: `Successfully renamed symbol in ${changedFiles.length} file(s) with ${totalChanges} change(s)`,
    changedFiles,
  };
}

/**
 * Process text edits and extract change information
 */
function processTextEdits(
  filePath: string,
  lines: string[],
  edits: TextEdit[],
): RenameSymbolSuccess["changedFiles"][0] {
  const changes: RenameSymbolSuccess["changedFiles"][0]["changes"] = [];

  for (const edit of edits) {
    const startLine = edit.range.start.line;
    const startCol = edit.range.start.character;
    const endLine = edit.range.end.line;
    const endCol = edit.range.end.character;

    // Extract old text
    let oldText = "";
    if (startLine === endLine) {
      oldText = lines[startLine].substring(startCol, endCol);
    } else {
      // Multi-line edit
      oldText = lines[startLine].substring(startCol);
      for (let i = startLine + 1; i < endLine; i++) {
        oldText += "\n" + lines[i];
      }
      oldText += "\n" + lines[endLine].substring(0, endCol);
    }

    changes.push({
      line: startLine + 1, // Convert to 1-based
      column: startCol + 1, // Convert to 1-based
      oldText,
      newText: edit.newText,
    });
  }

  return {
    filePath,
    changes,
  };
}

/**
 * Handle rename symbol request
 */
async function handleRenameSymbol(
  request: RenameSymbolRequest,
  client: LSPClient,
): Promise<Result<RenameSymbolSuccess, string>> {
  try {
    if (request.line !== undefined) {
      return performRenameWithLine(request, client);
    } else {
      return performRenameWithoutLine(request, client);
    }
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Find all TypeScript/JavaScript files in the project
 */
async function findProjectFiles(rootPath: string): Promise<string[]> {
  const files: string[] = [];
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs"];

  function walkDir(dir: string) {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          // Skip node_modules and hidden directories
          if (entry !== "node_modules" && !entry.startsWith(".")) {
            walkDir(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(fullPath);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (e) {
      debug(`[lspRenameSymbol] Error walking directory ${dir}:`, e);
    }
  }

  walkDir(rootPath);
  return files;
}

/**
 * Create rename symbol tool with injected LSP client
 */
export function createRenameSymbolTool(
  client: LSPClient,
): McpToolDef<typeof schema> {
  return {
    name: "rename_symbol",
    description:
      "Rename a symbol across the codebase using Language Server Protocol",
    schema,
    execute: async (args) => {
      const result = await handleRenameSymbol(args, client);
      if (result.isErr()) {
        throw new Error(result.error);
      }

      // Format output
      const { message, changedFiles } = result.value;
      const output = [message, "", "Changes:"];

      for (const file of changedFiles) {
        const relativePath = path.relative(args.root, file.filePath);
        output.push(`  ${relativePath}:`);

        for (const change of file.changes) {
          output.push(
            `    Line ${change.line}: "${change.oldText}" → "${change.newText}"`,
          );
        }
      }

      return output.join("\n");
    },
  };
}
