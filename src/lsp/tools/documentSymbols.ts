import { z } from "zod";
import {
  DocumentSymbol,
  SymbolInformation,
  SymbolKind,
} from "vscode-languageserver-types";
import type { ToolDef } from "../../mcp/utils/mcpHelpers.ts";
import { loadFileContext } from "../utils/fileContext.ts";
import { withTemporaryDocument } from "../utils/documentManager.ts";
import { fileLocationSchema } from "../../core/pure/schemas.ts";
import { formatLocation, formatRange } from "../../core/pure/formatting.ts";
import { getLSPClient } from "../lspClient.ts";

const schema = fileLocationSchema;

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

function formatDocumentSymbol(
  symbol: DocumentSymbol,
  indent: string = "",
): string {
  try {
    const kind =
      symbol.kind !== undefined ? getSymbolKindName(symbol.kind) : "Unknown";
    const deprecated = symbol.deprecated ? " (deprecated)" : "";
    const name = symbol.name || "Unnamed";
    let result = `${indent}${name} [${kind}]${deprecated}`;

    if (symbol.detail) {
      result += ` - ${symbol.detail}`;
    }

    if (symbol.range) {
      result += `\n${indent}  Range: ${formatRange(symbol.range)}`;
    }

    if (symbol.children && symbol.children.length > 0) {
      result += "\n";
      for (const child of symbol.children) {
        result += "\n" + formatDocumentSymbol(child, indent + "  ");
      }
    }

    return result;
  } catch (err) {
    return `${indent}Error formatting symbol: ${err}`;
  }
}

function formatSymbolInformation(symbol: SymbolInformation): string {
  try {
    const kind =
      symbol.kind !== undefined ? getSymbolKindName(symbol.kind) : "Unknown";
    const deprecated = symbol.deprecated ? " (deprecated)" : "";
    const container = symbol.containerName ? ` in ${symbol.containerName}` : "";
    const name = symbol.name || "Unnamed";

    let result = `${name} [${kind}]${deprecated}${container}`;
    if (symbol.location && symbol.location.range) {
      result += `\n  ${formatLocation(symbol.location)}`;
    }
    return result;
  } catch (err) {
    return `Error formatting symbol: ${err}`;
  }
}

async function handleGetDocumentSymbols({
  root,
  filePath,
}: z.infer<typeof schema>): Promise<string> {
  const { fileUri, content } = await loadFileContext(root, filePath);

  return withTemporaryDocument(fileUri, content, async () => {
    const client = getLSPClient();
    if (!client) {
      throw new Error("LSP client not initialized");
    }

    // Get document symbols
    let symbols: any[];
    try {
      symbols = await client.getDocumentSymbols(fileUri);
      console.log(
        `[DEBUG] Document symbols for ${filePath}:`,
        JSON.stringify(symbols, null, 2),
      );
    } catch (error) {
      console.error(
        `[DEBUG] Error getting document symbols for ${filePath}:`,
        error,
      );

      // Check if it's a method not supported error
      if (error && typeof error === "object" && "message" in error) {
        const errorMessage = String(error.message);
        if (
          errorMessage.includes("InvalidRequest") ||
          errorMessage.includes("method not found")
        ) {
          return `Document symbols not supported by this language server for ${filePath}`;
        }
      }

      return `Error getting document symbols: ${error}`;
    }

    if (!symbols || symbols.length === 0) {
      return `No symbols found in ${filePath}`;
    }

    // Format the symbols
    let result = `Document symbols in ${filePath}:\n\n`;

    // Check if we have DocumentSymbol[] or SymbolInformation[]
    // Some language servers may return DocumentSymbol without optional properties
    try {
      for (const symbol of symbols) {
        // Check each symbol individually to determine its type
        if ("location" in symbol && symbol.location) {
          // This is a SymbolInformation
          result +=
            formatSymbolInformation(symbol as SymbolInformation) + "\n\n";
        } else if (
          "range" in symbol ||
          "children" in symbol ||
          "selectionRange" in symbol
        ) {
          // This is a DocumentSymbol
          result += formatDocumentSymbol(symbol as DocumentSymbol) + "\n\n";
        } else {
          // Unknown format, try to format what we can
          const kind = symbol.kind ? getSymbolKindName(symbol.kind) : "Unknown";
          const name = symbol.name || "Unnamed";
          result += `${name} [${kind}]\n\n`;
        }
      }
    } catch (err) {
      // Fallback: just list symbol names
      result += "Error formatting symbols. Raw symbol names:\n";
      for (const symbol of symbols) {
        if (symbol && typeof symbol === "object" && "name" in symbol) {
          result += `- ${symbol.name}\n`;
        }
      }
    }

    return result.trim();
  });
}

export const lspGetDocumentSymbolsTool: ToolDef<typeof schema> = {
  name: "get_document_symbols",
  description:
    "Get all symbols (functions, classes, variables, etc.) in a document using LSP",
  schema,
  execute: async (args) => {
    return handleGetDocumentSymbols(args);
  },
};
