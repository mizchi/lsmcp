import { z } from "zod";
import type { ToolDef } from "../utils/mcpHelpers.ts";
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { existsSync } from "node:fs";
import { glob } from "glob";
import { minimatch } from "minimatch";
import { createGitignoreFilter } from "../../core/io/gitignoreUtils.ts";

const listDirSchema = z.object({
  relativePath: z
    .string()
    .describe(
      'The relative path to the directory to list; pass "." to scan the project root.',
    ),
  recursive: z
    .boolean()
    .describe("Whether to scan subdirectories recursively."),
  maxAnswerChars: z
    .number()
    .default(200000)
    .describe(
      "If the output is longer than this number of characters,\nno content will be returned. Don't adjust unless there is really no other way to get the content\nrequired for the task.",
    ),
});

export const listDirTool: ToolDef<typeof listDirSchema> = {
  name: "list_dir",
  description:
    "Lists all non-gitignored files and directories in the given directory (optionally with recursion). Returns a JSON object with the names of directories and files within the given directory.",
  schema: listDirSchema,
  execute: async ({ relativePath, recursive, maxAnswerChars = 200000 }) => {
    try {
      const rootPath = process.cwd();
      const absolutePath = join(rootPath, relativePath);

      if (!existsSync(absolutePath)) {
        return JSON.stringify({
          error: `Directory not found: ${relativePath}`,
        });
      }

      const gitignoreFilter = await createGitignoreFilter(rootPath);
      const result: { directories: string[]; files: string[] } = {
        directories: [],
        files: [],
      };

      async function scanDir(
        dirPath: string,
        depth: number = 0,
      ): Promise<void> {
        if (!recursive && depth > 0) return;

        const entries = await readdir(dirPath);

        for (const entry of entries) {
          const fullPath = join(dirPath, entry);
          const relPath = relative(rootPath, fullPath);

          // Skip if gitignored
          if (gitignoreFilter(relPath)) continue;

          const stats = await stat(fullPath);

          if (stats.isDirectory()) {
            result.directories.push(relPath);
            if (recursive) {
              await scanDir(fullPath, depth + 1);
            }
          } else if (stats.isFile()) {
            result.files.push(relPath);
          }
        }
      }

      await scanDir(absolutePath);

      const output = JSON.stringify(result, null, 2);
      if (output.length > maxAnswerChars) {
        return JSON.stringify({
          error: `Output too long (${output.length} chars). Try with a more specific path or without recursion.`,
        });
      }

      return output;
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

const findFileSchema = z.object({
  fileMask: z
    .string()
    .describe(
      "The filename or file mask (using the wildcards * or ?) to search for.",
    ),
  relativePath: z
    .string()
    .describe(
      'The relative path to the directory to search in; pass "." to scan the project root.',
    ),
});

export const findFileTool: ToolDef<typeof findFileSchema> = {
  name: "find_file",
  description:
    "Finds non-gitignored files matching the given file mask within the given relative path. Returns a JSON object with the list of matching files.",
  schema: findFileSchema,
  execute: async ({ fileMask, relativePath }) => {
    try {
      const rootPath = process.cwd();
      const searchPath = join(rootPath, relativePath);

      if (!existsSync(searchPath)) {
        return JSON.stringify({
          error: `Directory not found: ${relativePath}`,
        });
      }

      const gitignoreFilter = await createGitignoreFilter(rootPath);

      // Convert file mask to glob pattern
      const pattern =
        relativePath === "."
          ? `**/${fileMask}`
          : `${relativePath}/**/${fileMask}`;

      const files = await glob(pattern, {
        cwd: rootPath,
        ignore: ["**/node_modules/**", "**/.git/**"],
        nodir: true,
      });

      // Filter out gitignored files
      const filteredFiles = files.filter((file) => !gitignoreFilter(file));

      return JSON.stringify({ files: filteredFiles }, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

const searchForPatternSchema = z.object({
  substringPattern: z
    .string()
    .describe("Regular expression for a substring pattern to search for."),
  relativePath: z
    .string()
    .default("")
    .describe(
      "Only subpaths of this path (relative to the repo root) will be analyzed. If a path to a single\nfile is passed, only that will be searched. The path must exist, otherwise a `FileNotFoundError` is raised.",
    ),
  restrictSearchToCodeFiles: z
    .boolean()
    .default(false)
    .describe(
      "Whether to restrict the search to only those files where\nanalyzed code symbols can be found. Otherwise, will search all non-ignored files.\nSet this to True if your search is only meant to discover code that can be manipulated with symbolic tools.\nFor example, for finding classes or methods from a name pattern.\nSetting to False is a better choice if you also want to search in non-code files, like in html or yaml files,\nwhich is why it is the default.",
    ),
  pathsIncludeGlob: z
    .string()
    .optional()
    .describe(
      'Optional glob pattern specifying files to include in the search.\nMatches against relative file paths from the project root (e.g., "*.py", "src/**/*.ts").\nOnly matches files, not directories.',
    ),
  pathsExcludeGlob: z
    .string()
    .optional()
    .describe(
      'Optional glob pattern specifying files to exclude from the search.\nMatches against relative file paths from the project root (e.g., "*test*", "**/*_generated.py").\nTakes precedence over paths_include_glob. Only matches files, not directories.',
    ),
  contextLinesBefore: z
    .number()
    .default(0)
    .describe("Number of lines of context to include before each match."),
  contextLinesAfter: z
    .number()
    .default(0)
    .describe("Number of lines of context to include after each match."),
  maxAnswerChars: z
    .number()
    .default(200000)
    .describe(
      "If the output is longer than this number of characters,\nno content will be returned. Don't adjust unless there is really no other way to get the content\nrequired for the task. Instead, if the output is too long, you should\nmake a stricter query.",
    ),
});

export const searchForPatternTool: ToolDef<typeof searchForPatternSchema> = {
  name: "search_for_pattern",
  description:
    "Offers a flexible search for arbitrary patterns in the codebase, including the\npossibility to search in non-code files.\nGenerally, symbolic operations like find_symbol or find_referencing_symbols\nshould be preferred if you know which symbols you are looking for.\n\nPattern Matching Logic:\n    For each match, the returned result will contain the full lines where the\n    substring pattern is found, as well as optionally some lines before and after it. The pattern will be compiled with\n    DOTALL, meaning that the dot will match all characters including newlines.\n    This also means that it never makes sense to have .* at the beginning or end of the pattern,\n    but it may make sense to have it in the middle for complex patterns.\n    If a pattern matches multiple lines, all those lines will be part of the match.\n    Be careful to not use greedy quantifiers unnecessarily, it is usually better to use non-greedy quantifiers like .*? to avoid\n    matching too much content.\n\nFile Selection Logic:\n    The files in which the search is performed can be restricted very flexibly.\n    Using `restrict_search_to_code_files` is useful if you are only interested in code symbols (i.e., those\n    symbols that can be manipulated with symbolic tools like find_symbol).\n    You can also restrict the search to a specific file or directory,\n    and provide glob patterns to include or exclude certain files on top of that.\n    The globs are matched against relative file paths from the project root (not to the `relative_path` parameter that\n    is used to further restrict the search).\n    Smartly combining the various restrictions allows you to perform very targeted searches. Returns A JSON object mapping file paths to lists of matched consecutive lines (with context, if requested).",
  schema: searchForPatternSchema,
  execute: async ({
    substringPattern,
    relativePath = "",
    restrictSearchToCodeFiles = false,
    pathsIncludeGlob,
    pathsExcludeGlob,
    contextLinesBefore = 0,
    contextLinesAfter = 0,
    maxAnswerChars = 200000,
  }) => {
    try {
      const rootPath = process.cwd();
      const searchPath = relativePath ? join(rootPath, relativePath) : rootPath;

      if (!existsSync(searchPath)) {
        throw new Error(`Path not found: ${relativePath}`);
      }

      const gitignoreFilter = await createGitignoreFilter(rootPath);

      // Get files to search
      let searchPattern = relativePath ? `${relativePath}/**/*` : "**/*";
      if (restrictSearchToCodeFiles) {
        // Common code file extensions
        searchPattern = relativePath
          ? `${relativePath}/**/*.{ts,tsx,js,jsx,py,java,cpp,c,h,hpp,cs,rb,go,rs,php,swift,kt,scala,r,m,mm,fs,fsx,ml,mli}`
          : "**/*.{ts,tsx,js,jsx,py,java,cpp,c,h,hpp,cs,rb,go,rs,php,swift,kt,scala,r,m,mm,fs,fsx,ml,mli}";
      }

      const files = await glob(searchPattern, {
        cwd: rootPath,
        ignore: ["**/node_modules/**", "**/.git/**"],
        nodir: true,
      });

      // Apply filters
      let filteredFiles = files.filter((file) => !gitignoreFilter(file));

      if (pathsIncludeGlob) {
        filteredFiles = filteredFiles.filter((file) =>
          minimatch(file, pathsIncludeGlob),
        );
      }

      if (pathsExcludeGlob) {
        filteredFiles = filteredFiles.filter(
          (file) => !minimatch(file, pathsExcludeGlob),
        );
      }

      // Search in files
      const regex = new RegExp(substringPattern, "gms");
      const results: Record<string, string[]> = {};

      const { readFile } = await import("node:fs/promises");

      for (const file of filteredFiles) {
        const content = await readFile(join(rootPath, file), "utf-8");
        const lines = content.split("\n");
        const matches: Set<number> = new Set();

        // Find all matching lines
        let match;
        while ((match = regex.exec(content)) !== null) {
          const beforeMatch = content.substring(0, match.index);
          const startLine = beforeMatch.split("\n").length - 1;
          const matchLines = match[0].split("\n").length;

          for (let i = 0; i < matchLines; i++) {
            matches.add(startLine + i);
          }
        }

        if (matches.size > 0) {
          const matchedLines: string[] = [];
          const sortedMatches = Array.from(matches).sort((a, b) => a - b);

          let i = 0;
          while (i < sortedMatches.length) {
            const start = Math.max(0, sortedMatches[i] - contextLinesBefore);
            let end = Math.min(
              lines.length - 1,
              sortedMatches[i] + contextLinesAfter,
            );

            // Merge overlapping contexts
            let j = i + 1;
            while (
              j < sortedMatches.length &&
              sortedMatches[j] <= end + contextLinesBefore + 1
            ) {
              end = Math.min(
                lines.length - 1,
                sortedMatches[j] + contextLinesAfter,
              );
              j++;
            }

            for (let lineNum = start; lineNum <= end; lineNum++) {
              matchedLines.push(`${lineNum + 1}: ${lines[lineNum]}`);
            }

            if (j < sortedMatches.length) {
              matchedLines.push("...");
            }

            i = j;
          }

          results[file] = matchedLines;
        }
      }

      const output = JSON.stringify(results, null, 2);
      if (output.length > maxAnswerChars) {
        return JSON.stringify({
          error: `Output too long (${output.length} chars). Try with a more specific pattern or path.`,
        });
      }

      return output;
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
