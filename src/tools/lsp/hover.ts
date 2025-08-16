import { z } from "zod";
import { err, ok, type Result } from "neverthrow";
import { withLSPOperation, getLanguageIdFromPath } from "@internal/lsp-client";
import { createLSPTool } from "./toolFactory.ts";
import type { LSPClient } from "@internal/lsp-client";
import { resolveFileAndSymbol } from "./common.ts";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  relativePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line")
    .optional(),
  character: z
    .number()
    .describe("Character position in the line (0-based)")
    .optional(),
  column: z
    .number()
    .describe("Column position in the line (0-based)")
    .optional(),
  textTarget: z
    .string()
    .describe("Text to find and get hover information for")
    .optional(),
});

type GetHoverRequest = z.infer<typeof schema>;

/**
 * LSP Hover response types
 */
interface MarkupContent {
  kind: "plaintext" | "markdown";
  value: string;
}

type MarkedString = string | { language: string; value: string };

interface HoverResult {
  contents: MarkedString | MarkedString[] | MarkupContent;
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

interface GetHoverSuccess {
  message: string;
  hover: {
    contents: string;
    range?: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  } | null;
}

/**
 * Format hover result into GetHoverSuccess
 */
function formatHoverResult(
  result: HoverResult | null,
  request: GetHoverRequest,
  targetLine: number,
  symbolPosition: number,
): Result<GetHoverSuccess, string> {
  if (!result) {
    return ok({
      message: `No hover information available${
        request.textTarget ? ` for "${request.textTarget}"` : ""
      } at ${request.relativePath}:${targetLine + 1}:${symbolPosition + 1}`,
      hover: null,
    });
  }

  // Format hover contents
  const formattedContents = formatHoverContents(result.contents);

  // Format range - if not available, specify all lines
  let range;
  if (result.range) {
    range = {
      start: {
        line: result.range.start.line + 1,
        character: result.range.start.character + 1,
      },
      end: {
        line: result.range.end.line + 1,
        character: result.range.end.character + 1,
      },
    };
  } else {
    // If range is null, specify all lines
    const resolution = resolveFileAndSymbol({
      root: request.root,
      relativePath: request.relativePath,
    });
    const lines = resolution.lines;
    range = {
      start: {
        line: 1,
        character: 1,
      },
      end: {
        line: lines.length,
        character: lines[lines.length - 1]?.length || 0,
      },
    };
  }

  return ok({
    message: `Hover information for ${
      request.textTarget ? `"${request.textTarget}" at ` : ""
    }${request.relativePath}:${targetLine + 1}:${symbolPosition + 1}`,
    hover: {
      contents: formattedContents,
      range,
    },
  });
}

/**
 * Gets hover information for a TypeScript symbol using LSP
 */
async function getHover(
  request: GetHoverRequest,
  client: LSPClient,
): Promise<Result<GetHoverSuccess, string>> {
  try {
    // Resolve file and position
    let resolution;
    let targetLine: number;
    let symbolPosition: number;

    if (request.line === undefined && request.textTarget) {
      // Find textTarget without line
      resolution = resolveFileAndSymbol({
        root: request.root,
        relativePath: request.relativePath,
        textTarget: request.textTarget,
      });
      targetLine = resolution.lineIndex;
      symbolPosition = resolution.symbolIndex;
    } else if (request.line !== undefined) {
      if (request.character !== undefined) {
        // Use provided character position
        resolution = resolveFileAndSymbol({
          root: request.root,
          relativePath: request.relativePath,
          line: request.line,
        });
        targetLine = resolution.lineIndex;
        symbolPosition = request.character;
      } else if (request.textTarget) {
        // Find symbol in line
        resolution = resolveFileAndSymbol({
          root: request.root,
          relativePath: request.relativePath,
          line: request.line,
          symbolName: request.textTarget,
        });
        targetLine = resolution.lineIndex;
        symbolPosition = resolution.symbolIndex;
      } else {
        // Default to beginning of line
        resolution = resolveFileAndSymbol({
          root: request.root,
          relativePath: request.relativePath,
          line: request.line,
        });
        targetLine = resolution.lineIndex;
        symbolPosition = 0;
      }
    } else {
      // No line or textTarget provided
      return err("Either line or textTarget must be provided");
    }

    const { fileUri, fileContent } = resolution;

    // Get language ID from file extension
    const languageId = getLanguageIdFromPath(request.relativePath);

    if (!client) {
      return err("LSP client not available");
    }

    // Get hover info using LSP operation wrapper
    const result = await withLSPOperation({
      client,
      fileUri,
      fileContent,
      languageId: languageId || undefined,
      timeout: 5000, // 5 second timeout for hover operations
      operation: async (client) => {
        return (await client.getHover(fileUri, {
          line: targetLine,
          character: symbolPosition,
        })) as HoverResult | null;
      },
      errorContext: {
        operation: "get_hover",
        relativePath: request.relativePath,
        symbolName: request.textTarget,
        line: request.line,
      },
    });

    return formatHoverResult(result, request, targetLine, symbolPosition);
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Formats hover contents from various LSP formats to a string
 */
function formatHoverContents(
  contents: MarkedString | MarkedString[] | MarkupContent,
): string {
  if (typeof contents === "string") {
    return contents;
  } else if (Array.isArray(contents)) {
    return contents
      .map((content: MarkedString) => {
        if (typeof content === "string") {
          return content;
        } else {
          return content.value;
        }
      })
      .join("\n");
  } else if (typeof contents === "object" && contents && "value" in contents) {
    return (contents as MarkupContent).value;
  }
  return "";
}

/**
 * Create hover tool with injected LSP client
 */
export function createHoverTool(client: LSPClient) {
  return createLSPTool({
    name: "lsp_get_hover",
    description:
      "Get hover information (type signature, documentation) at a specific position using LSP. Requires exact line:column coordinates.",
    schema,
    language: "lsp",
    handler: (request) => getHover(request, client),
    formatSuccess: (result) => {
      const messages = [result.message];
      if (result.hover) {
        messages.push(result.hover.contents);
      }
      return messages.join("\n\n");
    },
  });
}

// Skip these tests - they require LSP server and should be run as integration tests
