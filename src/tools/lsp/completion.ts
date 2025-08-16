import type { LSPClient } from "@internal/lsp-client";
import { z } from "zod";
import { CompletionItem, CompletionItemKind } from "@internal/types";
import { commonSchemas } from "@internal/types";
import type { McpToolDef } from "@internal/types";
import {
  loadFileContext,
  withTemporaryDocument,
  resolveLineIndexOrThrow,
  createAdvancedCompletionHandler,
} from "@internal/lsp-client";

const schema = z.object({
  root: commonSchemas.root,
  relativePath: commonSchemas.relativePath,
  line: commonSchemas.line,
  column: commonSchemas.column.optional(),
  textTarget: z
    .string()
    .describe("Text at the position to get completions for")
    .optional(),
  resolve: z
    .boolean()
    .describe(
      "Whether to resolve completion items for additional details like auto-imports",
    )
    .optional()
    .default(false),
  includeAutoImport: z
    .boolean()
    .describe("Whether to include auto-import suggestions")
    .optional()
    .default(false),
});

function getCompletionItemKindName(kind?: CompletionItemKind): string {
  if (!kind) return "Unknown";

  const kindNames: Record<CompletionItemKind, string> = {
    [CompletionItemKind.Text]: "Text",
    [CompletionItemKind.Method]: "Method",
    [CompletionItemKind.Function]: "Function",
    [CompletionItemKind.Constructor]: "Constructor",
    [CompletionItemKind.Field]: "Field",
    [CompletionItemKind.Variable]: "Variable",
    [CompletionItemKind.Class]: "Class",
    [CompletionItemKind.Interface]: "Interface",
    [CompletionItemKind.Module]: "Module",
    [CompletionItemKind.Property]: "Property",
    [CompletionItemKind.Unit]: "Unit",
    [CompletionItemKind.Value]: "Value",
    [CompletionItemKind.Enum]: "Enum",
    [CompletionItemKind.Keyword]: "Keyword",
    [CompletionItemKind.Snippet]: "Snippet",
    [CompletionItemKind.Color]: "Color",
    [CompletionItemKind.File]: "File",
    [CompletionItemKind.Reference]: "Reference",
    [CompletionItemKind.Folder]: "Folder",
    [CompletionItemKind.EnumMember]: "EnumMember",
    [CompletionItemKind.Constant]: "Constant",
    [CompletionItemKind.Struct]: "Struct",
    [CompletionItemKind.Event]: "Event",
    [CompletionItemKind.Operator]: "Operator",
    [CompletionItemKind.TypeParameter]: "TypeParameter",
  };

  return kindNames[kind] || "Unknown";
}

function formatCompletionItem(
  item: CompletionItem,
  showImportInfo: boolean = false,
): string {
  const kind = getCompletionItemKindName(item.kind);
  let result = `${item.label} [${kind}]`;

  if (item.detail) {
    result += `\n${item.detail}`;
  }

  if (item.documentation) {
    const doc =
      typeof item.documentation === "string"
        ? item.documentation
        : item.documentation.value;
    if (doc) {
      // Truncate long documentation
      const maxDocLength = 200;
      const truncatedDoc =
        doc.length > maxDocLength
          ? doc.substring(0, maxDocLength) + "..."
          : doc;
      result += `\n\n${truncatedDoc}`;
    }
  }

  // Show auto-import information if available
  if (
    showImportInfo &&
    item.additionalTextEdits &&
    item.additionalTextEdits.length > 0
  ) {
    const importEdits = item.additionalTextEdits.filter((edit) => {
      // Check if the edit is likely an import statement
      const editText = edit.newText;
      return editText.includes("import") || editText.includes("from");
    });

    if (importEdits.length > 0) {
      result += "\n[Auto-import available]";
      for (const edit of importEdits) {
        result += `\n  ${edit.newText.trim()}`;
      }
    }
  }

  return result;
}

async function handleGetCompletion(
  {
    root,
    relativePath,
    line,
    column,
    textTarget,
    resolve,
    includeAutoImport,
  }: z.infer<typeof schema>,
  client: LSPClient,
): Promise<string> {
  if (!client) {
    throw new Error("LSP client not initialized");
  }
  const { fileUri, content } = await loadFileContext(
    root,
    relativePath,
    client.fileSystemApi,
  );
  const lineIndex = resolveLineIndexOrThrow(content, line, relativePath);

  // Determine character position
  const lines = content.split("\n");
  const lineText = lines[lineIndex];
  let character = lineText.length; // Default to end of line

  if (column !== undefined) {
    character = column;
  } else if (textTarget) {
    // Find the position after the textTarget text
    const targetIndex = lineText.indexOf(textTarget);
    if (targetIndex !== -1) {
      character = targetIndex + textTarget.length;
    }
  }

  return withTemporaryDocument(client, fileUri, content, async () => {
    // Use the advanced completion handler
    const handler = createAdvancedCompletionHandler({
      includeAutoImport,
      resolve,
    });

    // Get completions
    const completions = await client.getCompletion(fileUri, {
      line: lineIndex,
      character,
    });

    // Process with handler
    const processedCompletions = handler.processCompletionItems(
      completions || [],
    );
    const finalCompletions = processedCompletions.slice(0, 20);

    if (completions.length === 0) {
      const message = includeAutoImport
        ? `No auto-import completions available at ${relativePath}:${
            lineIndex + 1
          }:${character + 1}`
        : `No completions available at ${relativePath}:${lineIndex + 1}:${
            character + 1
          }`;
      return message;
    }

    // Format the completions
    let result = `Completions at ${relativePath}:${lineIndex + 1}:${
      character + 1
    }:\n\n`;

    for (const item of finalCompletions) {
      result += formatCompletionItem(item, resolve) + "\n\n";
    }

    // Note: We can't show "more completions" count anymore since we're using the handler
    // which already limits the results

    return result.trim();
  });
}

/**
 * Create completion tool with injected LSP client
 */
export function createCompletionTool(
  client: LSPClient,
): McpToolDef<typeof schema> {
  return {
    name: "lsp_get_completion",
    description:
      "Get code completion suggestions at a specific position using LSP. Requires exact line:column coordinates.",
    schema,
    execute: async (args) => {
      return handleGetCompletion(args, client);
    },
  };
}
