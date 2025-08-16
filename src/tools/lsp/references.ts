import type { LSPClient } from "@internal/lsp-client";
import type { McpToolDef } from "@internal/types";
import { z } from "zod";
import { err, ok, type Result } from "neverthrow";
import { readFileSync } from "fs";
import path from "path";
import type { ErrorContext } from "@internal/lsp-client";
import { formatError, validateLineAndSymbol } from "@internal/lsp-client";
import { pathToFileURL } from "url";

// Helper functions
function readFileWithMetadata(root: string, filePath: string) {
  const absolutePath = path.resolve(root, filePath);
  try {
    const fileContent = readFileSync(absolutePath, "utf-8");
    const fileUri = pathToFileURL(absolutePath).toString();
    return { fileContent, fileUri, absolutePath };
  } catch (error) {
    throw new Error(`File not found: ${filePath}`);
  }
}

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  relativePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
  column: z
    .number()
    .optional()
    .describe("Character position in the line (0-based)"),
  symbolName: z.string().describe("Name of the symbol to find references for"),
});

type FindReferencesRequest = z.infer<typeof schema>;

interface Reference {
  relativePath: string;
  line: number;
  column: number;
  text: string;
  preview: string;
}

interface FindReferencesSuccess {
  message: string;
  references: Reference[];
}

/**
 * Finds all references to a symbol using LSP
 */
async function findReferencesWithLSP(
  request: FindReferencesRequest,
  client: LSPClient,
): Promise<Result<FindReferencesSuccess, string>> {
  try {
    if (!client) {
      return err("LSP client not available");
    }

    // Read file content with metadata
    let fileContent: string;
    let fileUri: string;
    try {
      const result = readFileWithMetadata(request.root, request.relativePath);
      fileContent = result.fileContent;
      fileUri = result.fileUri;
    } catch (error) {
      const context: ErrorContext = {
        operation: "find references",
        filePath: request.relativePath,
        language: "lsp",
      };
      return err(formatError(error, context));
    }

    // Validate line and symbol
    let targetLine: number;
    let symbolPosition: number;
    try {
      const result = validateLineAndSymbol(
        fileContent,
        request.line,
        request.symbolName,
        request.relativePath,
      );
      targetLine = result.lineIndex;
      symbolPosition = result.symbolIndex;
    } catch (error) {
      const context: ErrorContext = {
        operation: "symbol validation",
        filePath: request.relativePath,
        symbolName: request.symbolName,
        details: { line: request.line },
      };
      return err(formatError(error, context));
    }

    // Open document in LSP
    client.openDocument(fileUri, fileContent);

    // Give LSP server time to process the document
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    // Find references
    const locations = await client.findReferences(fileUri, {
      line: targetLine,
      character: symbolPosition,
    });

    // Convert LSP locations to our Reference format
    const references: Reference[] = [];

    for (const location of locations) {
      const refPath = location.uri?.replace("file://", "") || "";
      let refContent: string;
      try {
        refContent = readFileSync(refPath, "utf-8");
      } catch (error) {
        // Skip references in files we can't read
        continue;
      }
      const refLines = refContent.split("\n");

      // Get the text at the reference location
      const startLine = location.range.start.line;
      const startCol = location.range.start.character;
      const endCol = location.range.end.character;
      const refLineText = refLines[startLine] || "";
      const text = refLineText.substring(startCol, endCol);

      // Create preview with context
      const prevLine = startLine > 0 ? refLines[startLine - 1] : "";
      const nextLine =
        startLine < refLines.length - 1 ? refLines[startLine + 1] : "";
      const preview = [
        prevLine && `${startLine}: ${prevLine}`,
        `${startLine + 1}: ${refLineText}`,
        nextLine && `${startLine + 2}: ${nextLine}`,
      ]
        .filter(Boolean)
        .join("\n");

      references.push({
        relativePath: path.relative(request.root, refPath),
        line: startLine + 1, // Convert to 1-based
        column: startCol + 1, // Convert to 1-based
        text,
        preview,
      });
    }

    return ok({
      message: `Found ${references.length} reference${
        references.length === 1 ? "" : "s"
      } to "${request.symbolName}"`,
      references,
    });
  } catch (error) {
    const context: ErrorContext = {
      operation: "find references",
      filePath: request.relativePath,
      symbolName: request.symbolName,
      language: "lsp",
    };
    return err(formatError(error, context));
  }
}

export async function findReferences(
  request: FindReferencesRequest,
  client: LSPClient,
): Promise<Result<FindReferencesSuccess, string>> {
  return findReferencesWithLSP(request, client);
}

/**
 * Create references tool with injected LSP client
 */
export function createReferencesTool(
  client: LSPClient,
): McpToolDef<typeof schema> {
  return {
    name: "lsp_find_references",
    description:
      "Find all references to a symbol at a specific position using LSP. Requires exact line:column coordinates.",
    schema,
    execute: async (args: z.infer<typeof schema>) => {
      const result = await findReferencesWithLSP(args, client);
      if (result.isOk()) {
        const messages = [result.value.message];

        if (result.value.references.length > 0) {
          messages.push(
            result.value.references
              .map(
                (ref) =>
                  `\n${ref.relativePath}:${ref.line}:${ref.column}\n${ref.preview}`,
              )
              .join("\n"),
          );
        }

        return messages.join("\n\n");
      } else {
        throw new Error(result.error);
      }
    },
  };
}

// Skip these tests - they require LSP server and should be run as integration tests
