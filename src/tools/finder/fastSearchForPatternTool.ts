import { z } from "zod";
import { join, relative } from "node:path";
import { minimatch } from "minimatch";
import { readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import type { McpToolDef, FileSystemApi } from "@internal/types";
import { nodeFileSystemApi } from "../../infrastructure/NodeFileSystemApi.ts";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

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

// Fast recursive file finder without gitaware-glob
async function* walkFiles(
  dir: string,
  extensions?: Set<string>,
  ignorePatterns?: string[],
  rootPath?: string,
): AsyncGenerator<string> {
  const actualRoot = rootPath || dir;

  // Check for .gitignore in current directory
  const gitignorePath = join(dir, ".gitignore");
  let localIgnorePatterns = [...(ignorePatterns || [])];

  if (existsSync(gitignorePath)) {
    const gitignoreContent = readFileSync(gitignorePath, "utf-8");
    const patterns = gitignoreContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    localIgnorePatterns.push(...patterns);
  }

  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = relative(actualRoot, fullPath);

    // Check ignore patterns
    const shouldIgnore = localIgnorePatterns.some((pattern) => {
      // Handle directory patterns
      if (pattern.endsWith("/")) {
        return (
          entry.isDirectory() && minimatch(entry.name, pattern.slice(0, -1))
        );
      }
      // Handle ** patterns
      if (pattern.includes("**")) {
        return minimatch(relativePath, pattern);
      }
      // Simple patterns
      return minimatch(entry.name, pattern) || minimatch(relativePath, pattern);
    });

    if (shouldIgnore) continue;

    if (entry.isDirectory()) {
      // Always skip these directories
      if (
        [
          "node_modules",
          ".git",
          "dist",
          "build",
          ".next",
          ".nuxt",
          "coverage",
          ".cache",
          "tmp",
          "temp",
        ].includes(entry.name)
      ) {
        continue;
      }

      yield* walkFiles(fullPath, extensions, localIgnorePatterns, actualRoot);
    } else if (entry.isFile()) {
      // Check file extension if restricted
      if (extensions) {
        const ext = entry.name.split(".").pop();
        if (!ext || !extensions.has(ext)) continue;
      }

      yield relativePath;
    }
  }
}

// Stream-based file processor
async function processFileStream(
  filePath: string,
  regex: RegExp,
  contextLinesBefore: number,
  contextLinesAfter: number,
  maxMatches = 100,
): Promise<string[] | null> {
  return new Promise((resolve) => {
    const matches: string[] = [];
    const buffer: string[] = [];
    let lineNumber = 0;
    let pendingContext = 0;
    let lastMatchLine = -1;

    const stream = createReadStream(filePath, { encoding: "utf8" });
    const rl = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      lineNumber++;
      buffer.push(line);

      if (buffer.length > contextLinesBefore + 1) {
        buffer.shift();
      }

      regex.lastIndex = 0;
      const isMatch = regex.test(line);

      if (isMatch) {
        const skipLines = Math.max(
          0,
          lastMatchLine +
            contextLinesAfter +
            1 -
            (lineNumber - contextLinesBefore),
        );
        const startIdx = Math.max(
          0,
          buffer.length - contextLinesBefore - 1 + skipLines,
        );

        const contextLines = [];
        for (let i = startIdx; i < buffer.length; i++) {
          const actualLineNum = lineNumber - (buffer.length - 1 - i);
          contextLines.push(`${actualLineNum}: ${buffer[i]}`);
        }

        matches.push(contextLines.join("\n"));
        lastMatchLine = lineNumber;
        pendingContext = contextLinesAfter;

        if (matches.length >= maxMatches) {
          matches.push("... (truncated, too many matches)");
          rl.close();
          return;
        }
      } else if (pendingContext > 0) {
        matches[matches.length - 1] += `\n${lineNumber}: ${line}`;
        pendingContext--;
      }
    });

    rl.on("close", () => {
      resolve(matches.length > 0 ? matches : null);
    });

    rl.on("error", () => {
      resolve(null);
    });

    stream.on("error", () => {
      resolve(null);
    });
  });
}

export function createFastSearchForPatternTool(
  fileSystemApi: FileSystemApi = nodeFileSystemApi,
): McpToolDef<typeof searchForPatternSchema> {
  return {
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
        const searchPath = relativePath
          ? relativePath.startsWith("/")
            ? relativePath
            : join(rootPath, relativePath)
          : rootPath;

        if (!(await fileSystemApi.exists(searchPath))) {
          return JSON.stringify({
            error: `Path not found: ${relativePath || "."}`,
          });
        }

        // Determine files to search
        let filesToSearch: string[] = [];
        const searchPathStats = await fileSystemApi.stat(searchPath);

        if (searchPathStats.isFile()) {
          filesToSearch = [relative(rootPath, searchPath)];
        } else {
          // Define code file extensions
          const codeExtensions = restrictSearchToCodeFiles
            ? new Set([
                "js",
                "jsx",
                "ts",
                "tsx",
                "py",
                "java",
                "go",
                "rs",
                "rb",
                "php",
                "c",
                "cpp",
                "h",
                "hpp",
                "cs",
                "swift",
                "kt",
                "scala",
                "clj",
                "ex",
                "exs",
                "lua",
                "r",
                "m",
                "mm",
                "fs",
                "fsx",
                "ml",
                "mli",
                "hs",
                "elm",
                "vue",
                "svelte",
              ])
            : undefined;

          // Use our fast file walker
          const files: string[] = [];
          for await (const file of walkFiles(
            searchPath,
            codeExtensions,
            undefined,
            rootPath,
          )) {
            const relFile = file;

            // Apply include/exclude patterns
            if (pathsExcludeGlob && minimatch(relFile, pathsExcludeGlob)) {
              continue;
            }
            if (pathsIncludeGlob && !minimatch(relFile, pathsIncludeGlob)) {
              continue;
            }

            files.push(file);
          }

          filesToSearch = files;
        }

        // Search in files
        const results: Record<string, string[]> = {};
        const regex = new RegExp(substringPattern, "gm");

        const BATCH_SIZE = 20;
        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
        let totalSize = 0;

        // Process files in batches
        for (let i = 0; i < filesToSearch.length; i += BATCH_SIZE) {
          const batch = filesToSearch.slice(i, i + BATCH_SIZE);

          const batchPromises = batch.map(async (file) => {
            const filePath = file.startsWith("/") ? file : join(rootPath, file);

            try {
              const stats = await fileSystemApi.stat(filePath);
              if (stats.size > MAX_FILE_SIZE) {
                return { file, matches: null };
              }

              let matches: string[] | null;

              if (stats.size > 50 * 1024) {
                // 50KB threshold
                matches = await processFileStream(
                  filePath,
                  regex,
                  contextLinesBefore,
                  contextLinesAfter,
                );
              } else {
                const content = await fileSystemApi.readFile(filePath);
                const lines = content.split("\n");
                matches = [];

                for (let i = 0; i < lines.length; i++) {
                  regex.lastIndex = 0;
                  if (regex.test(lines[i])) {
                    const startLine = Math.max(0, i - contextLinesBefore);
                    const endLine = Math.min(
                      lines.length - 1,
                      i + contextLinesAfter,
                    );

                    const contextLines = [];
                    for (let j = startLine; j <= endLine; j++) {
                      contextLines.push(`${j + 1}: ${lines[j]}`);
                    }

                    matches.push(contextLines.join("\n"));

                    if (matches.length > 100) {
                      matches.push("... (truncated, too many matches)");
                      break;
                    }
                  }
                }

                matches = matches.length > 0 ? matches : null;
              }

              return { file, matches };
            } catch (error) {
              return { file, matches: null };
            }
          });

          const batchResults = await Promise.all(batchPromises);

          for (const result of batchResults) {
            if (result.matches) {
              results[result.file] = result.matches;
              totalSize += JSON.stringify(result.matches).length;

              if (totalSize > maxAnswerChars * 0.8) {
                const output = JSON.stringify(results, null, 2);
                if (output.length > maxAnswerChars) {
                  return JSON.stringify({
                    error: `Output too long (${output.length} chars). Try with a more specific pattern or path.`,
                  });
                }
                return output;
              }
            }
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
}
