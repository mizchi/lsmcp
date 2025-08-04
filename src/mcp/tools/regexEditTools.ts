import { z } from "zod";
import type { ToolDef } from "../../mcp/utils/mcpHelpers.ts";
// Define SerenityEditResult type locally
export interface SerenityEditResult {
  success: boolean;
  error?: string;
  filesChanged?: string[];
}
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const replaceRegexSchema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  relativePath: z.string().describe("The relative path to the file"),
  regex: z.string().describe("Python-style regular expression to match"),
  repl: z
    .string()
    .describe("Replacement string with backreferences like $1, $2"),
  allowMultipleOccurrences: z
    .boolean()
    .default(false)
    .describe("Replace all occurrences if true"),
});

export const replaceRegexTool: ToolDef<typeof replaceRegexSchema> = {
  name: "replace_regex",
  description:
    "Replace content using regular expressions with dotall and multiline flags",
  schema: replaceRegexSchema,
  execute: async ({
    root,
    relativePath,
    regex,
    repl,
    allowMultipleOccurrences = false,
  }) => {
    try {
      const absolutePath = resolve(root, relativePath);

      // Read the file
      const fileContent = await readFile(absolutePath, "utf-8");

      // Create regex with dotall (s) and multiline (m) flags
      const regexObj = new RegExp(regex, "sm");

      // Test how many matches there are
      const matches = Array.from(
        fileContent.matchAll(new RegExp(regex, "gms")),
      );

      if (matches.length === 0) {
        return JSON.stringify({
          success: false,
          error: `No matches found for regex: ${regex}`,
        } as SerenityEditResult);
      }

      if (!allowMultipleOccurrences && matches.length > 1) {
        return JSON.stringify({
          success: false,
          error: `Multiple occurrences found (${matches.length}). Set allowMultipleOccurrences to true or use a more specific regex.`,
        } as SerenityEditResult);
      }

      // Perform replacement
      let newContent: string;
      if (allowMultipleOccurrences) {
        // Replace all occurrences
        newContent = fileContent.replace(new RegExp(regex, "gms"), repl);
      } else {
        // Replace only the first occurrence
        newContent = fileContent.replace(regexObj, repl);
      }

      // Check if content actually changed
      if (newContent === fileContent) {
        return JSON.stringify({
          success: false,
          error: "No changes made - replacement resulted in identical content",
        } as SerenityEditResult);
      }

      // Write back
      await writeFile(absolutePath, newContent, "utf-8");

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
