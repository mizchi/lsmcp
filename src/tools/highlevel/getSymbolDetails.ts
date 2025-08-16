/**
 * High-level tool for getting comprehensive symbol details
 * Combines hover, definitions, and references information
 */

import { z } from "zod";
import type { McpToolDef, McpContext } from "@internal/types";
import type { LSPClient } from "@internal/lsp-client";
import { pathToFileURL } from "url";
import { join } from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { withLSPOperation, resolveLineParameter } from "@internal/lsp-client";
import { findSymbolInLine } from "../../features/ts/utils/findSymbolInLine.ts";

const schema = z.object({
  root: z.string().describe("Root directory for the project").optional(),
  relativePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  line: z
    .union([z.number(), z.string()])
    .describe("Line number (1-based) or string to match in the line"),
  symbol: z.string().describe("Symbol name to get details for"),
});

interface SymbolDetails {
  symbol: string;
  file: string;
  position: {
    line: number;
    character: number;
  };
  hover?: {
    type?: string;
    documentation?: string;
    signature?: string;
  };
  definition?: {
    file: string;
    line: number;
    character: number;
    preview?: string;
  };
  references?: Array<{
    file: string;
    line: number;
    character: number;
    preview: string;
  }>;
  error?: string;
}

/**
 * Format hover contents from LSP response
 */
function formatHoverContents(contents: any): {
  type?: string;
  documentation?: string;
  signature?: string;
} {
  const result: { type?: string; documentation?: string; signature?: string } =
    {};

  if (!contents) return result;

  let text = "";
  if (typeof contents === "string") {
    text = contents;
  } else if (Array.isArray(contents)) {
    text = contents
      .map((c) => (typeof c === "string" ? c : c.value))
      .join("\n");
  } else if (contents.value) {
    text = contents.value;
  }

  // Parse the text to extract type, signature, and documentation
  const lines = text.split("\n");
  const codeBlockRegex = /^```(\w+)?/;
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let documentation: string[] = [];

  for (const line of lines) {
    if (codeBlockRegex.test(line)) {
      if (inCodeBlock && codeBlockContent.length > 0) {
        // End of code block
        const code = codeBlockContent.join("\n").trim();
        if (!result.type && !result.signature) {
          // First code block is usually type/signature
          if (code.includes("(") && code.includes(")")) {
            result.signature = code;
          } else {
            result.type = code;
          }
        }
        codeBlockContent = [];
      }
      inCodeBlock = !inCodeBlock;
    } else if (inCodeBlock) {
      codeBlockContent.push(line);
    } else if (line.trim()) {
      documentation.push(line);
    }
  }

  // Handle any remaining code block
  if (codeBlockContent.length > 0) {
    const code = codeBlockContent.join("\n").trim();
    if (!result.type && !result.signature) {
      if (code.includes("(") && code.includes(")")) {
        result.signature = code;
      } else {
        result.type = code;
      }
    }
  }

  if (documentation.length > 0) {
    result.documentation = documentation.join("\n").trim();
  }

  return result;
}

/**
 * Get comprehensive details about a symbol
 */
async function getSymbolDetailsImpl(
  args: z.infer<typeof schema>,
  client: LSPClient,
  _context?: McpContext,
): Promise<SymbolDetails> {
  const rootPath = args.root || process.cwd();
  const absolutePath = join(rootPath, args.relativePath);

  if (!existsSync(absolutePath)) {
    return {
      symbol: args.symbol,
      file: args.relativePath,
      position: { line: 0, character: 0 },
      error: `File not found: ${args.relativePath}`,
    };
  }

  try {
    const fileContent = await readFile(absolutePath, "utf-8");
    const lines = fileContent.split("\n");
    const fileUri = pathToFileURL(absolutePath).toString();

    // Resolve line number
    const lineIndex = resolveLineParameter(lines, args.line);
    if (lineIndex === -1) {
      return {
        symbol: args.symbol,
        file: args.relativePath,
        position: { line: 0, character: 0 },
        error: `Line not found: ${args.line}`,
      };
    }

    // Find symbol position in line
    const symbolResult = findSymbolInLine(lines[lineIndex], args.symbol);
    if ("error" in symbolResult) {
      return {
        symbol: args.symbol,
        file: args.relativePath,
        position: { line: lineIndex + 1, character: 0 },
        error: `Symbol "${args.symbol}" not found on line ${lineIndex + 1}`,
      };
    }

    const position = {
      line: lineIndex,
      character: symbolResult.characterIndex,
    };
    const result: SymbolDetails = {
      symbol: args.symbol,
      file: args.relativePath,
      position: {
        line: lineIndex + 1,
        character: symbolResult.characterIndex + 1,
      },
    };

    // Open document in LSP
    client.openDocument(fileUri, fileContent);

    try {
      // Get hover information
      const hoverResult = await withLSPOperation({
        client,
        fileUri,
        fileContent,
        timeout: 5000,
        operation: async (client) => {
          return await client.getHover(fileUri, position);
        },
        errorContext: {
          operation: "get_hover",
          relativePath: args.relativePath,
          symbolName: args.symbol,
        },
      });

      if (hoverResult) {
        result.hover = formatHoverContents(hoverResult.contents);
      }

      // Get definition
      const definitionResult = await withLSPOperation({
        client,
        fileUri,
        fileContent,
        timeout: 5000,
        operation: async (client) => {
          return await client.getDefinition(fileUri, position);
        },
        errorContext: {
          operation: "get_definition",
          relativePath: args.relativePath,
          symbolName: args.symbol,
        },
      });

      if (definitionResult) {
        // Handle single Location or Location array
        const definitions = Array.isArray(definitionResult)
          ? definitionResult
          : [definitionResult];
        if (definitions.length > 0) {
          const def = definitions[0];
          // Check if it's a LocationLink or Location
          const uri = "targetUri" in def ? def.targetUri : def.uri;
          const range = "targetRange" in def ? def.targetRange : def.range;

          const defPath = uri.replace("file://", "");
          const defRelativePath = defPath.replace(rootPath + "/", "");

          result.definition = {
            file: defRelativePath,
            line: range.start.line + 1,
            character: range.start.character + 1,
          };

          // Get preview of definition
          if (existsSync(defPath)) {
            const defContent = await readFile(defPath, "utf-8");
            const defLines = defContent.split("\n");
            const startLine = Math.max(0, range.start.line - 1);
            const endLine = Math.min(defLines.length, range.end.line + 2);
            result.definition.preview = defLines
              .slice(startLine, endLine)
              .join("\n");
          }
        }
      }

      // Get references
      const referencesResult = await withLSPOperation({
        client,
        fileUri,
        fileContent,
        timeout: 10000,
        operation: async (client) => {
          return await client.findReferences(fileUri, position);
        },
        errorContext: {
          operation: "get_references",
          relativePath: args.relativePath,
          symbolName: args.symbol,
        },
      });

      if (referencesResult && referencesResult.length > 0) {
        result.references = [];

        // Limit to first 20 references for readability
        const refsToShow = referencesResult.slice(0, 20);

        for (const ref of refsToShow) {
          const refPath = ref.uri.replace("file://", "");
          const refRelativePath = refPath.replace(rootPath + "/", "");

          const refEntry: any = {
            file: refRelativePath,
            line: ref.range.start.line + 1,
            character: ref.range.start.character + 1,
            preview: "",
          };

          // Get preview of reference
          if (existsSync(refPath)) {
            const refContent = await readFile(refPath, "utf-8");
            const refLines = refContent.split("\n");
            if (ref.range.start.line < refLines.length) {
              refEntry.preview = refLines[ref.range.start.line].trim();
            }
          }

          result.references.push(refEntry);
        }

        if (referencesResult.length > 20) {
          result.references.push({
            file: "...",
            line: 0,
            character: 0,
            preview: `... and ${referencesResult.length - 20} more references`,
          });
        }
      }
    } finally {
      // Close document
      client.closeDocument(fileUri);
    }

    return result;
  } catch (error) {
    return {
      symbol: args.symbol,
      file: args.relativePath,
      position: { line: 0, character: 0 },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Format symbol details for display
 */
function formatSymbolDetails(details: SymbolDetails): string {
  let output = `## Symbol Details: ${details.symbol}\n\n`;

  output += `**Location:** ${details.file}:${details.position.line}:${details.position.character}\n\n`;

  if (details.error) {
    output += `**Error:** ${details.error}\n`;
    return output;
  }

  // Hover information
  if (details.hover) {
    output += "### Type Information\n";
    if (details.hover.type) {
      output += "```typescript\n" + details.hover.type + "\n```\n";
    }
    if (details.hover.signature) {
      output +=
        "**Signature:**\n```typescript\n" + details.hover.signature + "\n```\n";
    }
    if (details.hover.documentation) {
      output += "**Documentation:**\n" + details.hover.documentation + "\n";
    }
    output += "\n";
  }

  // Definition
  if (details.definition) {
    output += "### Definition\n";
    output += `**File:** ${details.definition.file}:${details.definition.line}:${details.definition.character}\n`;
    if (details.definition.preview) {
      output += "```typescript\n" + details.definition.preview + "\n```\n";
    }
    output += "\n";
  }

  // References
  if (details.references && details.references.length > 0) {
    output += `### References (${details.references.length})\n`;
    for (const ref of details.references) {
      if (ref.file === "...") {
        output += `\n${ref.preview}\n`;
      } else {
        output += `- **${ref.file}:${ref.line}** - \`${ref.preview}\`\n`;
      }
    }
    output += "\n";
  }

  // Guidance for next steps
  output += "### Next Steps\n";
  output +=
    "- Use `lsp_get_definitions` with `includeBody: true` to see full implementation\n";
  output += "- Use `lsp_find_references` to see all usages in detail\n";
  output +=
    "- Use `lsp_rename_symbol` to rename this symbol across the codebase\n";

  return output;
}

/**
 * Create the get_symbol_details tool
 */
export function createGetSymbolDetailsTool(
  client: LSPClient,
): McpToolDef<typeof schema> {
  return {
    name: "get_symbol_details",
    description:
      "Get comprehensive details about a symbol including type information, definition, and references. " +
      "This is a high-level tool that combines hover, definition, and references information. " +
      "Use after search_symbols to get detailed information about a specific symbol.",
    schema,
    execute: async (args, context?: McpContext) => {
      const details = await getSymbolDetailsImpl(args, client, context);
      return formatSymbolDetails(details);
    },
  };
}
