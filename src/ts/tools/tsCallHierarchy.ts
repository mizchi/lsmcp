import { z } from "zod";
import type { ToolDef } from "../../mcp/utils/mcpHelpers.ts";
import { commonSchemas } from "../../core/pure/schemas.ts";
import { relative } from "path";
import { errors } from "../../core/pure/errors/index.ts";
import { Position } from "vscode-languageserver-types";
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
    // Read file content with metadata
    const { fileContent: content, fileUri } = readFileWithMetadata(
      root,
      filePath,
    );

    // Create TypeScript LSP client
    const clientInstance = await createTypescriptLSPClient(root);
    const { client } = clientInstance;

    try {
      // Validate line and symbol
      const { lineIndex, symbolIndex } = validateLineAndSymbol(
        content,
        line,
        symbolName,
        filePath,
      );

      const position: Position = {
        line: lineIndex,
        character: symbolIndex,
      };

      // Open the document
      openDocument(client, fileUri, content);

      // Wait for LSP to process the document
      await waitForLSP();

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
        throw errors.generic(
          `No call hierarchy available for "${symbolName}"`,
          undefined,
          {
            operation: "call_hierarchy",
            filePath,
            symbolName,
            line,
          },
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
        const incomingCalls = await getCallHierarchy(
          client,
          item,
          new Set(),
          0,
          maxDepth,
          "incoming",
        );
        output += formatCallTree(incomingCalls, "incoming");
        output += "\n";
      }

      // Get outgoing calls
      if (direction === "outgoing" || direction === "both") {
        output += "## 📤 Outgoing Calls (what this function calls)\n\n";
        const outgoingCalls = await getCallHierarchy(
          client,
          item,
          new Set(),
          0,
          maxDepth,
          "outgoing",
        );
        output += formatCallTree(outgoingCalls, "outgoing");
      }

      return output.trim();
    } finally {
      await stopLSPClient(clientInstance);
    }
  },
};

// Generic recursive function to get call hierarchy
async function getCallHierarchy(
  client: any,
  item: CallHierarchyItem,
  visited: Set<string>,
  depth: number,
  maxDepth: number,
  direction: "incoming" | "outgoing",
): Promise<any[]> {
  if (depth >= maxDepth) return [];

  const key = `${item.uri}:${item.range.start.line}:${item.range.start.character}`;
  if (visited.has(key)) return [];
  visited.add(key);

  const params = { item };
  const method =
    direction === "incoming"
      ? "callHierarchy/incomingCalls"
      : "callHierarchy/outgoingCalls";
  const calls = await client.sendRequest(method, params);

  const results = [];
  for (const call of calls || []) {
    const nextItem = direction === "incoming" ? call.from : call.to;
    const subCalls = await getCallHierarchy(
      client,
      nextItem,
      visited,
      depth + 1,
      maxDepth,
      direction,
    );

    results.push({
      item: nextItem,
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
