import type { LSPClient } from "@internal/lsp-client";
import { z } from "zod";
import { commonSchemas } from "@internal/types";
import { err, ok, type Result } from "neverthrow";
import type { McpToolDef } from "@internal/types";
import { debug, validateLineAndSymbol } from "@internal/lsp-client";
import { readFileSync } from "fs";
import path from "path";
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
  root: commonSchemas.root,
  relativePath: commonSchemas.relativePath.describe(
    "File path containing the symbol (relative to root)",
  ),
  line: commonSchemas.line,
  column: commonSchemas.character
    .optional()
    .describe("Character position in the line (0-based)"),
  symbolName: commonSchemas.symbolName.describe(
    "Name of the symbol to get definitions for",
  ),
  before: commonSchemas.before.optional(),
  after: commonSchemas.after.optional(),
  includeBody: commonSchemas.includeBody
    .optional()
    .describe(
      "Include the full body of the symbol (for classes, functions, interfaces)",
    ),
});

type GetDefinitionsRequest = z.infer<typeof schema>;

interface Definition {
  relativePath: string;
  line: number;
  column: number;
  symbolName: string;
  preview: string;
}

interface GetDefinitionsSuccess {
  message: string;
  definitions: Definition[];
}

// Import Location and LocationLink types from vscode-languageserver-types via lspTypes
import type {
  Location,
  LocationLink,
  DocumentSymbol,
  SymbolInformation,
} from "@internal/lsp-client";

/**
 * Find the symbol containing the given position in a document symbols tree
 */
function findSymbolAtPosition(
  symbols: DocumentSymbol[] | SymbolInformation[],
  line: number,
  character: number,
): DocumentSymbol | SymbolInformation | null {
  for (const symbol of symbols) {
    if ("range" in symbol) {
      // DocumentSymbol
      const ds = symbol as DocumentSymbol;
      const range = ds.range;

      // Check if position is within this symbol's range
      if (
        (range.start.line < line ||
          (range.start.line === line && range.start.character <= character)) &&
        (range.end.line > line ||
          (range.end.line === line && range.end.character >= character))
      ) {
        // Check children first for more specific match
        if (ds.children && ds.children.length > 0) {
          const childMatch = findSymbolAtPosition(ds.children, line, character);
          if (childMatch) {
            return childMatch;
          }
        }
        return ds;
      }
    } else {
      // SymbolInformation
      const si = symbol as SymbolInformation;
      const range = si.location.range;

      // Check if position is within this symbol's range
      if (
        (range.start.line < line ||
          (range.start.line === line && range.start.character <= character)) &&
        (range.end.line > line ||
          (range.end.line === line && range.end.character >= character))
      ) {
        return si;
      }
    }
  }

  return null;
}

/**
 * Gets definitions for a TypeScript symbol using LSP
 */
async function getDefinitionsWithLSP(
  request: GetDefinitionsRequest,
  client: LSPClient,
): Promise<Result<GetDefinitionsSuccess, string>> {
  try {
    if (!client) {
      return err("LSP client not available");
    }

    // Read file content with metadata
    const { fileContent, fileUri } = readFileWithMetadata(
      request.root,
      request.relativePath,
    );

    // Validate line and symbol
    const { lineIndex: targetLine, symbolIndex: symbolPosition } =
      validateLineAndSymbol(
        fileContent,
        request.line,
        request.symbolName,
        request.relativePath,
      );

    // Open document in LSP
    client.openDocument(fileUri, fileContent);

    // Give LSP server time to process the document
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));

    debug("[lspGetDefinitions] Getting definition for:", {
      fileUri,
      position: { line: targetLine, character: symbolPosition },
      symbolName: request.symbolName,
    });

    // Get definition
    const result = await client.getDefinition(fileUri, {
      line: targetLine,
      character: symbolPosition,
    });

    // Normalize result to array
    const locations = result ? (Array.isArray(result) ? result : [result]) : [];

    debug(
      "[lspGetDefinitions] Raw LSP result:",
      JSON.stringify(result, null, 2),
    );
    debug(
      "[lspGetDefinitions] Normalized locations:",
      JSON.stringify(locations, null, 2),
    );

    // Convert LSP locations to our Definition format
    const definitions: Definition[] = [];
    const contextBefore = request.before || 2;
    const contextAfter = request.after || 2;

    if (locations.length === 0) {
      debug("[lspGetDefinitions] No definitions found");
      return ok({
        message: `No definitions found for "${request.symbolName}"`,
        definitions: [],
      });
    }

    for (const loc of locations) {
      // Handle LocationLink vs Location
      let location: Location;
      if ("targetUri" in loc) {
        // This is a LocationLink
        const link = loc as LocationLink;
        location = {
          uri: link.targetUri,
          range: link.targetSelectionRange || link.targetRange,
        };
      } else {
        // This is already a Location
        location = loc as Location;
      }

      // Handle different URI formats
      let defPath = "";
      if (location.uri) {
        debug("[lspGetDefinitions] Processing location URI:", location.uri);
        // Remove file:// prefix and handle both file:// and file:/// formats
        defPath = location.uri.replace(/^file:\/\/\/?/, "/");
        // For Windows paths, handle file:///C:/ format
        if (defPath.match(/^\/[A-Za-z]:\//)) {
          defPath = defPath.substring(1);
        }
        debug("[lspGetDefinitions] Resolved path:", defPath);
      } else {
        debug("[lspGetDefinitions] Location has no URI:", location);
        // Skip if no URI
        continue;
      }

      // Try to read the definition file
      let defContent: string;
      let defLines: string[];
      try {
        defContent = readFileSync(defPath, "utf-8");
        defLines = defContent.split("\n");
      } catch (e) {
        // Skip if file cannot be read
        continue;
      }

      // Get the text at the definition location
      const startLine = location.range.start.line;
      const startCol = location.range.start.character;
      const defLineText = defLines[startLine] || "";

      // Try to extract the symbol text from the line
      let symbolName = "";

      // Simple heuristic to find identifier boundaries
      const identifierPattern = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;
      let match;
      while ((match = identifierPattern.exec(defLineText)) !== null) {
        if (
          match.index <= startCol &&
          startCol < match.index + match[0].length
        ) {
          symbolName = match[0];
          break;
        }
      }

      // If no symbol found, use the requested symbol name
      if (!symbolName) {
        symbolName = request.symbolName;
      }

      // Create preview with context or full body
      let preview: string;

      if (request.includeBody) {
        // Try to get the full body of the symbol using document symbols
        try {
          // Get document symbols for the definition file
          const defFileUri = `file://${defPath}`;
          const symbols = await client.getDocumentSymbols(defFileUri);

          // Find the symbol at the definition position
          const targetSymbol = findSymbolAtPosition(
            symbols,
            startLine,
            startCol,
          );

          if (targetSymbol) {
            // Get the full range of the symbol
            const symbolRange =
              "range" in targetSymbol
                ? targetSymbol.range
                : targetSymbol.location.range;

            // Extract the lines for the full symbol body
            const bodyLines: string[] = [];
            for (
              let i = symbolRange.start.line;
              i <= Math.min(defLines.length - 1, symbolRange.end.line);
              i++
            ) {
              bodyLines.push(`${i + 1}: ${defLines[i]}`);
            }
            preview = bodyLines.join("\n");
          } else {
            // Fallback to context-based preview if symbol not found
            const previewLines: string[] = [];
            for (
              let i = Math.max(0, startLine - contextBefore);
              i <= Math.min(defLines.length - 1, startLine + contextAfter);
              i++
            ) {
              previewLines.push(`${i + 1}: ${defLines[i]}`);
            }
            preview = previewLines.join("\n");
          }
        } catch (e) {
          // Fallback to context-based preview if document symbols fails
          const previewLines: string[] = [];
          for (
            let i = Math.max(0, startLine - contextBefore);
            i <= Math.min(defLines.length - 1, startLine + contextAfter);
            i++
          ) {
            previewLines.push(`${i + 1}: ${defLines[i]}`);
          }
          preview = previewLines.join("\n");
        }
      } else {
        // Standard context-based preview
        const previewLines: string[] = [];
        for (
          let i = Math.max(0, startLine - contextBefore);
          i <= Math.min(defLines.length - 1, startLine + contextAfter);
          i++
        ) {
          previewLines.push(`${i + 1}: ${defLines[i]}`);
        }
        preview = previewLines.join("\n");
      }

      definitions.push({
        relativePath: path.relative(request.root, defPath),
        line: startLine + 1, // Convert to 1-based
        column: startCol + 1, // Convert to 1-based
        symbolName,
        preview,
      });
    }

    return ok({
      message: `Found ${definitions.length} definition${
        definitions.length === 1 ? "" : "s"
      } for "${request.symbolName}"`,
      definitions,
    });
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

export async function getDefinitions(
  request: GetDefinitionsRequest,
  client: LSPClient,
): Promise<Result<GetDefinitionsSuccess, string>> {
  return getDefinitionsWithLSP(request, client);
}

/**
 * Create definitions tool with injected LSP client
 */
export function createDefinitionsTool(
  client: LSPClient,
): McpToolDef<typeof schema> {
  return {
    name: "lsp_get_definitions",
    description:
      "Get the definition(s) of a symbol at a specific position using LSP. Requires exact line:column coordinates.",
    schema,
    execute: async (args: z.infer<typeof schema>) => {
      const result = await getDefinitionsWithLSP(args, client);
      if (result.isOk()) {
        const messages = [result.value.message];

        if (result.value.definitions.length > 0) {
          for (const def of result.value.definitions) {
            messages.push(
              `\n${def.relativePath}:${def.line}:${def.column} - ${def.symbolName}\n${def.preview}`,
            );
          }
        }

        return messages.join("\n\n");
      } else {
        throw new Error(result.error);
      }
    },
  };
}

// Skip these tests - they require LSP server and should be run as integration tests
