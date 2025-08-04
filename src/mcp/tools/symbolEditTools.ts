import { z } from "zod";
import type { ToolDef } from "../utils/mcpHelpers.ts";
import type { SerenityEditResult } from "./regexEditTools.ts";
import { getSymbolIndex, querySymbols } from "../../indexer/symbolIndex.ts";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { markFileModified } from "../../indexer/utils/autoIndex.ts";

const replaceSymbolBodySchema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  namePath: z
    .string()
    .describe("Symbol name path (e.g., 'ClassName/methodName')"),
  relativePath: z
    .string()
    .describe("File path containing the symbol (relative to root)"),
  body: z
    .string()
    .describe("New symbol body. Begin directly with the symbol definition"),
});

export const replaceSymbolBodyTool: ToolDef<typeof replaceSymbolBodySchema> = {
  name: "replace_symbol_body",
  description: "Replace the entire body of a symbol",
  schema: replaceSymbolBodySchema,
  execute: async ({ root, namePath, relativePath, body }) => {
    try {
      const index = getSymbolIndex(root);
      const absolutePath = resolve(root, relativePath);

      // Find the symbol using the index
      const symbols = querySymbols(index, {
        name: namePath.split("/").pop(),
        file: relativePath,
      });

      // Filter by full name path
      const targetSymbol = symbols.find((sym) => {
        // Build full name path for comparison
        const parts = [];
        let current = sym;
        parts.unshift(current.name);

        while (current.containerName) {
          const container = symbols.find(
            (s) => s.name === current.containerName,
          );
          if (!container) break;
          parts.unshift(container.name);
          current = container;
        }

        return parts.join("/") === namePath;
      });

      if (!targetSymbol) {
        return JSON.stringify({
          success: false,
          error: `Symbol '${namePath}' not found in ${relativePath}`,
        } as SerenityEditResult);
      }

      // Read the file content
      const fileContent = await readFile(absolutePath, "utf-8");
      const lines = fileContent.split("\n");

      // Calculate the replacement
      const startLine = targetSymbol.location.range.start.line;
      const endLine = targetSymbol.location.range.end.line;

      // Get indentation from the first line
      const firstLine = lines[startLine];
      const indentMatch = firstLine.match(/^(\s*)/);
      const baseIndent = indentMatch ? indentMatch[1] : "";

      // Apply indentation to body lines
      const bodyLines = body.split("\n");
      const indentedBody = bodyLines
        .map((line, index) => {
          if (index === 0) return line; // First line uses existing indent
          return line ? baseIndent + line : line;
        })
        .join("\n");

      // Replace the symbol body
      lines.splice(
        startLine,
        endLine - startLine + 1,
        baseIndent + indentedBody,
      );

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

const insertBeforeSymbolSchema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  namePath: z.string().describe("Symbol name path before which to insert"),
  relativePath: z.string().describe("File path containing the symbol"),
  body: z.string().describe("Content to insert before the symbol"),
});

export const insertBeforeSymbolTool: ToolDef<typeof insertBeforeSymbolSchema> =
  {
    name: "insert_before_symbol",
    description: "Insert content before a symbol definition",
    schema: insertBeforeSymbolSchema,
    execute: async ({ root, namePath, relativePath, body }) => {
      try {
        const index = getSymbolIndex(root);
        const absolutePath = resolve(root, relativePath);

        // Find the symbol
        const symbols = querySymbols(index, {
          name: namePath.split("/").pop(),
          file: relativePath,
        });

        const targetSymbol = symbols.find((sym) => {
          const parts = [];
          let current = sym;
          parts.unshift(current.name);

          while (current.containerName) {
            const container = symbols.find(
              (s) => s.name === current.containerName,
            );
            if (!container) break;
            parts.unshift(container.name);
            current = container;
          }

          return parts.join("/") === namePath;
        });

        if (!targetSymbol) {
          return JSON.stringify({
            success: false,
            error: `Symbol '${namePath}' not found in ${relativePath}`,
          } as SerenityEditResult);
        }

        // Read the file
        const fileContent = await readFile(absolutePath, "utf-8");
        const lines = fileContent.split("\n");

        // Insert before the symbol
        const insertLine = targetSymbol.location.range.start.line;

        // Ensure body ends with newline if it doesn't
        const bodyToInsert = body.endsWith("\n") ? body : body + "\n";

        lines.splice(insertLine, 0, ...bodyToInsert.split("\n").slice(0, -1));

        // Write back
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

const insertAfterSymbolSchema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  namePath: z.string().describe("Symbol name path after which to insert"),
  relativePath: z.string().describe("File path containing the symbol"),
  body: z.string().describe("Content to insert after the symbol"),
});

export const insertAfterSymbolTool: ToolDef<typeof insertAfterSymbolSchema> = {
  name: "insert_after_symbol",
  description: "Insert content after a symbol definition",
  schema: insertAfterSymbolSchema,
  execute: async ({ root, namePath, relativePath, body }) => {
    try {
      const index = getSymbolIndex(root);
      const absolutePath = resolve(root, relativePath);

      // Find the symbol
      const symbols = querySymbols(index, {
        name: namePath.split("/").pop(),
        file: relativePath,
      });

      const targetSymbol = symbols.find((sym) => {
        const parts = [];
        let current = sym;
        parts.unshift(current.name);

        while (current.containerName) {
          const container = symbols.find(
            (s) => s.name === current.containerName,
          );
          if (!container) break;
          parts.unshift(container.name);
          current = container;
        }

        return parts.join("/") === namePath;
      });

      if (!targetSymbol) {
        return JSON.stringify({
          success: false,
          error: `Symbol '${namePath}' not found in ${relativePath}`,
        } as SerenityEditResult);
      }

      // Read the file
      const fileContent = await readFile(absolutePath, "utf-8");
      const lines = fileContent.split("\n");

      // Insert after the symbol
      const insertLine = targetSymbol.location.range.end.line + 1;

      // Ensure body starts with newline if it doesn't
      const bodyToInsert = body.startsWith("\n") ? body.slice(1) : body;

      lines.splice(insertLine, 0, ...bodyToInsert.split("\n"));

      // Write back
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
