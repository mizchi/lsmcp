import { z } from "zod";
import type { ToolDef } from "../../mcp/_mcplib.ts";
import { commonSchemas } from "../../common/schemas.ts";
import { createLSPClient } from "../../lsp/lspClient.ts";
import { spawn } from "child_process";
import { readFileSync } from "fs";
import { join, relative } from "path";
import { MCPToolError } from "../../common/mcpErrors.ts";
import { Position } from "vscode-languageserver-types";
import { findTypescriptLanguageServer } from "../utils/findTypescriptLanguageServer.ts";

const schema = z.object({
  root: commonSchemas.root,
  filePath: commonSchemas.filePath,
  line: commonSchemas.line,
  symbolName: z.string().describe("Symbol to get call hierarchy for"),
  direction: z
    .enum(["incoming", "outgoing", "both"])
    .optional()
    .default("both")
    .describe("Direction of calls to show"),
  maxDepth: z
    .number()
    .optional()
    .default(3)
    .describe("Maximum depth to traverse the call hierarchy"),
});

// TypeScript Language Server specific types for call hierarchy
interface CallHierarchyItem {
  name: string;
  kind: number;
  uri: string;
  range: Range;
  selectionRange: Range;
}

interface Range {
  start: Position;
  end: Position;
}

export const callHierarchyTool: ToolDef<typeof schema> = {
  name: "call_hierarchy",
  description:
    "Get call hierarchy (incoming/outgoing calls) for a function or method (TypeScript only)",
  schema,
  execute: async ({
    root,
    filePath,
    line,
    symbolName,
    direction,
    maxDepth,
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

      // Find line and character position
      const lineIndex = typeof line === "string"
        ? lines.findIndex((l) => l.includes(line))
        : line - 1;

      if (lineIndex < 0) {
        throw new MCPToolError(
          "Could not find specified line in file",
          "LINE_NOT_FOUND",
        );
      }

      const lineContent = lines[lineIndex];
      const symbolIndex = lineContent.indexOf(symbolName);

      if (symbolIndex < 0) {
        throw new MCPToolError(
          `Symbol "${symbolName}" not found on line ${lineIndex + 1}`,
          "SYMBOL_NOT_FOUND",
        );
      }

      const position: Position = {
        line: lineIndex,
        character: symbolIndex,
      };

      try {
        // Start the client
        await client.start();

        // Open the document
        client.openDocument(fileUri, content, "typescript");

        // Wait for LSP to process the document
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Prepare call hierarchy
        const prepareParams = {
          textDocument: { uri: fileUri },
          position,
        };

        const items = await client.sendRequest<CallHierarchyItem[] | null>(
          "textDocument/prepareCallHierarchy",
          prepareParams,
        );

        if (!items || items.length === 0) {
          throw new MCPToolError(
            `No call hierarchy available for "${symbolName}"`,
            "NO_CALL_HIERARCHY",
            [
              "Ensure the symbol is a function or method",
              "The cursor must be on the function/method name",
            ],
          );
        }

        const item = items[0];
        let output = `# Call Hierarchy for ${item.name}\n\n`;
        output += `📍 ${relative(root, item.uri.replace("file://", ""))}:${
          item.range.start.line + 1
        }\n\n`;

        // Get incoming calls
        if (direction === "incoming" || direction === "both") {
          output += "## 📥 Incoming Calls (who calls this function)\n\n";
          const incomingCalls = await getIncomingCalls(
            client,
            item,
            new Set(),
            0,
            maxDepth,
            root,
          );
          output += formatCallTree(incomingCalls, "incoming");
          output += "\n";
        }

        // Get outgoing calls
        if (direction === "outgoing" || direction === "both") {
          output += "## 📤 Outgoing Calls (what this function calls)\n\n";
          const outgoingCalls = await getOutgoingCalls(
            client,
            item,
            new Set(),
            0,
            maxDepth,
            root,
          );
          output += formatCallTree(outgoingCalls, "outgoing");
        }

        return output.trim();
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

// Recursive function to get incoming calls
async function getIncomingCalls(
  client: any,
  item: CallHierarchyItem,
  visited: Set<string>,
  depth: number,
  maxDepth: number,
  root: string,
): Promise<any[]> {
  if (depth >= maxDepth) return [];

  const key =
    `${item.uri}:${item.range.start.line}:${item.range.start.character}`;
  if (visited.has(key)) return [];
  visited.add(key);

  const params = { item };
  const calls = await client.sendRequest("callHierarchy/incomingCalls", params);

  const results = [];
  for (const call of calls || []) {
    const subCalls = await getIncomingCalls(
      client,
      call.from,
      visited,
      depth + 1,
      maxDepth,
      root,
    );

    results.push({
      item: call.from,
      fromRanges: call.fromRanges,
      children: subCalls,
      depth,
    });
  }

  return results;
}

// Recursive function to get outgoing calls
async function getOutgoingCalls(
  client: any,
  item: CallHierarchyItem,
  visited: Set<string>,
  depth: number,
  maxDepth: number,
  root: string,
): Promise<any[]> {
  if (depth >= maxDepth) return [];

  const key =
    `${item.uri}:${item.range.start.line}:${item.range.start.character}`;
  if (visited.has(key)) return [];
  visited.add(key);

  const params = { item };
  const calls = await client.sendRequest("callHierarchy/outgoingCalls", params);

  const results = [];
  for (const call of calls || []) {
    const subCalls = await getOutgoingCalls(
      client,
      call.to,
      visited,
      depth + 1,
      maxDepth,
      root,
    );

    results.push({
      item: call.to,
      fromRanges: call.fromRanges,
      children: subCalls,
      depth,
    });
  }

  return results;
}

// Format the call tree for display
function formatCallTree(
  calls: any[],
  direction: "incoming" | "outgoing",
): string {
  if (calls.length === 0) {
    return "  (no calls found)\n";
  }

  let output = "";
  for (const call of calls) {
    const indent = "  ".repeat(call.depth);
    const arrow = direction === "incoming" ? "←" : "→";
    const relativePath = call.item.uri.startsWith("file://")
      ? call.item.uri.substring(7)
      : call.item.uri;

    output += `${indent}${arrow} ${call.item.name} `;
    output += `(${relativePath}:${call.item.range.start.line + 1})\n`;

    if (call.children && call.children.length > 0) {
      output += formatCallTree(call.children, direction);
    }
  }

  return output;
}
