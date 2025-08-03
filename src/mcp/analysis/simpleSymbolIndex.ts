/**
 * Simplified symbol index implementation
 */

import { SymbolKind } from "vscode-languageserver-types";

function getSymbolKindName(kind: SymbolKind): string {
  const symbolKindNames: Record<SymbolKind, string> = {
    [SymbolKind.File]: "File",
    [SymbolKind.Module]: "Module",
    [SymbolKind.Namespace]: "Namespace",
    [SymbolKind.Package]: "Package",
    [SymbolKind.Class]: "Class",
    [SymbolKind.Method]: "Method",
    [SymbolKind.Property]: "Property",
    [SymbolKind.Field]: "Field",
    [SymbolKind.Constructor]: "Constructor",
    [SymbolKind.Enum]: "Enum",
    [SymbolKind.Interface]: "Interface",
    [SymbolKind.Function]: "Function",
    [SymbolKind.Variable]: "Variable",
    [SymbolKind.Constant]: "Constant",
    [SymbolKind.String]: "String",
    [SymbolKind.Number]: "Number",
    [SymbolKind.Boolean]: "Boolean",
    [SymbolKind.Array]: "Array",
    [SymbolKind.Object]: "Object",
    [SymbolKind.Key]: "Key",
    [SymbolKind.Null]: "Null",
    [SymbolKind.EnumMember]: "EnumMember",
    [SymbolKind.Struct]: "Struct",
    [SymbolKind.Event]: "Event",
    [SymbolKind.Operator]: "Operator",
    [SymbolKind.TypeParameter]: "TypeParameter",
  };
  return symbolKindNames[kind] || "Unknown";
}
import type { ToolDef } from "../utils/mcpHelpers.ts";
import { z } from "zod";
import { getLSPClient } from "../../lsp/lspClient.ts";
import { loadFileContext } from "../../lsp/utils/fileContext.ts";
import { withTemporaryDocument } from "../../lsp/utils/documentManager.ts";
import { glob } from "glob";

// Simple in-memory index
interface IndexedSymbol {
  name: string;
  kind: SymbolKind;
  filePath: string;
  line: number;
  containerName?: string;
}

const symbolIndex: Map<string, IndexedSymbol[]> = new Map();

// Schema for simple index
const simpleIndexFilesSchema = z.object({
  pattern: z.string().describe("Glob pattern for files to index"),
  root: z.string().describe("Root directory").optional(),
});

export const simpleIndexFilesTool: ToolDef<typeof simpleIndexFilesSchema> = {
  name: "simple_index_files",
  description: "Simple symbol indexing for testing",
  schema: simpleIndexFilesSchema,
  execute: async ({ pattern, root }) => {
    const rootPath = root || process.cwd();
    const client = getLSPClient();

    if (!client) {
      return "LSP client not initialized";
    }

    // Clear index
    symbolIndex.clear();

    // Find files
    const files = await glob(pattern, {
      cwd: rootPath,
      ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    });

    if (files.length === 0) {
      return `No files found matching pattern: ${pattern}`;
    }

    let totalSymbols = 0;
    const startTime = Date.now();

    // Index each file
    for (const file of files) {
      try {
        const { fileUri, content } = await loadFileContext(rootPath, file);

        const symbols = await withTemporaryDocument(
          fileUri,
          content,
          async () => {
            return await client.getDocumentSymbols(fileUri);
          },
        );

        if (symbols && symbols.length > 0) {
          const indexed: IndexedSymbol[] = [];

          const processSymbol = (symbol: any, containerName?: string) => {
            indexed.push({
              name: symbol.name,
              kind: symbol.kind,
              filePath: file,
              line:
                symbol.location?.range?.start?.line ||
                symbol.range?.start?.line ||
                0,
              containerName,
            });

            // Process children
            if (symbol.children) {
              for (const child of symbol.children) {
                processSymbol(child, symbol.name);
              }
            }
          };

          for (const symbol of symbols) {
            processSymbol(symbol);
          }

          symbolIndex.set(file, indexed);
          totalSymbols += indexed.length;
        }
      } catch (error) {
        console.error(`Failed to index ${file}:`, error);
      }
    }

    const duration = Date.now() - startTime;

    return `Indexed ${files.length} files in ${duration}ms
Total symbols: ${totalSymbols}
Files with symbols: ${symbolIndex.size}`;
  },
};

// Simple search
const simpleSearchSchema = z.object({
  query: z.string().describe("Symbol name to search for"),
  root: z.string().describe("Root directory").optional(),
});

export const simpleSearchSymbolTool: ToolDef<typeof simpleSearchSchema> = {
  name: "simple_search_symbol",
  description: "Simple symbol search",
  schema: simpleSearchSchema,
  execute: async ({ query, root }) => {
    root || process.cwd();
    const results: IndexedSymbol[] = [];

    // Search in index
    for (const [_, symbols] of symbolIndex) {
      for (const symbol of symbols) {
        if (symbol.name.toLowerCase().includes(query.toLowerCase())) {
          results.push(symbol);
        }
      }
    }

    if (results.length === 0) {
      return "No symbols found";
    }

    // Format results
    let output = `Found ${results.length} symbol(s):\n\n`;

    for (const result of results.slice(0, 20)) {
      const kindName = getSymbolKindName(result.kind);
      output += `${result.name} [${kindName}]`;
      if (result.containerName) {
        output += ` in ${result.containerName}`;
      }
      output += `\n  ${result.filePath}:${result.line + 1}\n\n`;
    }

    if (results.length > 20) {
      output += `... and ${results.length - 20} more results`;
    }

    return output;
  },
};

export const simpleAnalysisTools = [
  simpleIndexFilesTool,
  simpleSearchSymbolTool,
];
