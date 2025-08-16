import { z } from "zod";
import type { McpToolDef } from "@internal/types";
import type { SerenityEditResult } from "./regexEditTools.ts";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { markFileModified } from "@internal/code-indexer";

const replaceRangeSchema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  relativePath: z.string().describe("File path to edit (relative to root)"),
  startLine: z.number().describe("Start line number (1-based, inclusive)"),
  startCharacter: z
    .number()
    .describe("Start character position in the line (0-based)"),
  endLine: z.number().describe("End line number (1-based, inclusive)"),
  endCharacter: z
    .number()
    .describe("End character position in the line (0-based)"),
  newContent: z
    .string()
    .describe(
      "New content to replace the range with (empty string for deletion)",
    ),
  preserveIndentation: z
    .boolean()
    .default(true)
    .describe("Whether to preserve the indentation of the first line"),
});

/**
 * Replace a range of text in a file with new content
 * This is a more flexible alternative to symbol-based editing
 */
export const replaceRangeTool: McpToolDef<typeof replaceRangeSchema> = {
  name: "replace_range",
  description:
    "Replace a specific range of text in a file. " +
    "Use this after getting position information from lsp_get_definitions or other LSP tools. " +
    "Can be used to: replace symbol bodies, insert before/after symbols, delete ranges, or make precise edits. " +
    "Line numbers are 1-based, character positions are 0-based.",
  schema: replaceRangeSchema,
  execute: async ({
    root,
    relativePath,
    startLine,
    startCharacter,
    endLine,
    endCharacter,
    newContent,
    preserveIndentation,
  }) => {
    try {
      const absolutePath = resolve(root, relativePath);

      // Read the file content
      const fileContent = await readFile(absolutePath, "utf-8");
      const lines = fileContent.split("\n");

      // Validate line numbers
      if (startLine < 1 || startLine > lines.length) {
        return JSON.stringify({
          success: false,
          error: `Invalid start line ${startLine}. File has ${lines.length} lines.`,
        } as SerenityEditResult);
      }

      if (endLine < startLine || endLine > lines.length) {
        return JSON.stringify({
          success: false,
          error: `Invalid end line ${endLine}. Must be >= ${startLine} and <= ${lines.length}.`,
        } as SerenityEditResult);
      }

      // Convert to 0-based indices
      const startLineIdx = startLine - 1;
      const endLineIdx = endLine - 1;

      // Validate character positions
      if (startCharacter < 0 || startCharacter > lines[startLineIdx].length) {
        return JSON.stringify({
          success: false,
          error: `Invalid start character ${startCharacter} on line ${startLine}. Line has ${lines[startLineIdx].length} characters.`,
        } as SerenityEditResult);
      }

      if (endCharacter < 0 || endCharacter > lines[endLineIdx].length) {
        return JSON.stringify({
          success: false,
          error: `Invalid end character ${endCharacter} on line ${endLine}. Line has ${lines[endLineIdx].length} characters.`,
        } as SerenityEditResult);
      }

      // Extract indentation if needed
      let baseIndent = "";
      if (preserveIndentation && newContent) {
        const indentMatch = lines[startLineIdx].match(/^(\s*)/);
        baseIndent = indentMatch ? indentMatch[1] : "";
      }

      // Apply indentation to new content if needed
      let processedContent = newContent;
      if (preserveIndentation && baseIndent && newContent) {
        const contentLines = newContent.split("\n");
        processedContent = contentLines
          .map((line, index) => {
            // Don't add indent to empty lines
            if (!line.trim()) return line;
            // First line uses the indent from its position
            if (index === 0 && startCharacter > 0) return line;
            // Other lines get the base indent
            return baseIndent + line;
          })
          .join("\n");
      }

      // Perform the replacement
      if (startLineIdx === endLineIdx) {
        // Single line replacement
        const line = lines[startLineIdx];
        const before = line.substring(0, startCharacter);
        const after = line.substring(endCharacter);
        lines[startLineIdx] = before + processedContent + after;
      } else {
        // Multi-line replacement
        const firstLine = lines[startLineIdx].substring(0, startCharacter);
        const lastLine = lines[endLineIdx].substring(endCharacter);

        // Combine the replacement
        const replacement = firstLine + processedContent + lastLine;
        const replacementLines = replacement.split("\n");

        // Splice in the new lines
        lines.splice(
          startLineIdx,
          endLineIdx - startLineIdx + 1,
          ...replacementLines,
        );
      }

      // Write back to file
      await writeFile(absolutePath, lines.join("\n"), "utf-8");

      // Mark file as modified for auto-indexing
      markFileModified(root, absolutePath);

      return JSON.stringify({
        success: true,
        filesChanged: [relativePath],
      } as SerenityEditResult);
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as SerenityEditResult);
    }
  },
};
