import { z } from "zod";
import { join, relative } from "node:path";
import { glob as gitawareGlob, type FileSystemInterface } from "gitaware-glob";
import { minimatch } from "minimatch";
import type { FileSystemApi } from "@lsmcp/types";
import { nodeFileSystemApi } from "../../filesystem/NodeFileSystemApi.ts";
import type { McpToolDef } from "@lsmcp/types";

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

export function createListDirTool(
  fileSystemApi: FileSystemApi = nodeFileSystemApi,
): McpToolDef<typeof listDirSchema> {
  return {
    name: "list_dir",
    description:
      "Lists all non-gitignored files and directories in the given directory (optionally with recursion). Returns a JSON object with the names of directories and files within the given directory.",
    schema: listDirSchema,
    execute: async ({ relativePath, recursive, maxAnswerChars = 200000 }) => {
      try {
        const rootPath = process.cwd();
        const absolutePath = join(rootPath, relativePath);

        if (!(await fileSystemApi.exists(absolutePath))) {
          return JSON.stringify({
            error: `Directory not found: ${relativePath}`,
          });
        }

        // Use gitaware-glob for consistent gitignore handling
        const globPattern = recursive
          ? join(relativePath, "**", "*")
          : join(relativePath, "*");
        const globOptions = {
          cwd: rootPath,
          gitignore: true,
          onlyFiles: false,
          markDirectories: true,
          absolute: false,
        };

        // Use custom fs if not using nodeFileSystemApi
        if (fileSystemApi !== nodeFileSystemApi) {
          (globOptions as any).fs =
            fileSystemApi as unknown as FileSystemInterface;
        }

        const result: { directories: string[]; files: string[] } = {
          directories: [],
          files: [],
        };

        for await (const path of gitawareGlob(globPattern, globOptions)) {
          const isDirectory = path.endsWith("/");
          const cleanPath = isDirectory ? path.slice(0, -1) : path;

          if (isDirectory) {
            result.directories.push(cleanPath);
          } else {
            result.files.push(cleanPath);
          }
        }

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
}

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

export function createFindFileTool(
  fileSystemApi: FileSystemApi = nodeFileSystemApi,
): McpToolDef<typeof findFileSchema> {
  return {
    name: "find_file",
    description:
      "Finds non-gitignored files matching the given file mask within the given relative path. Returns a JSON object with the list of matching files.",
    schema: findFileSchema,
    execute: async ({ fileMask, relativePath }) => {
      try {
        const rootPath = process.cwd();
        const searchPath = join(rootPath, relativePath);

        if (!(await fileSystemApi.exists(searchPath))) {
          return JSON.stringify({
            error: `Directory not found: ${relativePath}`,
          });
        }

        const stats = await fileSystemApi.stat(searchPath);
        if (!stats.isDirectory()) {
          return JSON.stringify({
            error: `Path is not a directory: ${relativePath}`,
          });
        }

        // Convert file mask to a gitaware-glob pattern
        const globPattern = fileMask.includes("/")
          ? join(relativePath, fileMask)
          : join(relativePath, "**", fileMask);

        // Handle different FileSystemApi implementations
        const globOptions: {
          cwd: string;
          ignore: string[];
          fs?: FileSystemInterface;
        } = {
          cwd: rootPath,
          ignore: [
            "**/node_modules/**",
            "**/.git/**",
            "**/dist/**",
            "**/build/**",
            "**/.next/**",
            "**/.nuxt/**",
            "**/coverage/**",
            "**/.nyc_output/**",
            "**/.cache/**",
            "**/tmp/**",
            "**/temp/**",
            "**/.DS_Store",
            "**/*.log",
          ],
        };

        // If not using nodeFileSystemApi, provide fs option for gitaware-glob
        if (fileSystemApi !== nodeFileSystemApi) {
          // Create a compatible fs interface for gitaware-glob
          globOptions.fs = fileSystemApi as unknown as FileSystemInterface;
        }

        const matches = [];
        for await (const file of gitawareGlob(globPattern, globOptions)) {
          matches.push(file);
        }

        const result = {
          files: matches.map((file) => relative(relativePath, file)),
        };

        return JSON.stringify(result, null, 2);
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}

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

export function createSearchForPatternTool(
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
          ? join(rootPath, relativePath)
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
          filesToSearch = [searchPath];
        } else {
          // Get all files in the directory
          const globPattern = restrictSearchToCodeFiles
            ? join(
                relativePath || ".",
                "**/*.{js,jsx,ts,tsx,py,java,go,rs,rb,php,c,cpp,h,hpp,cs,swift,kt,scala,clj,ex,exs,lua,r,m,mm,fs,fsx,ml,mli,hs,elm,vue,svelte}",
              )
            : join(relativePath || ".", "**/*");

          const globOptions: {
            cwd: string;
            ignore: string[];
            fs?: FileSystemInterface;
          } = {
            cwd: rootPath,
            ignore: [
              "**/node_modules/**",
              "**/.git/**",
              "**/dist/**",
              "**/build/**",
              "**/.next/**",
              "**/.nuxt/**",
              "**/coverage/**",
              "**/.nyc_output/**",
              "**/.cache/**",
              "**/tmp/**",
              "**/temp/**",
              "**/.DS_Store",
              "**/*.log",
            ],
          };

          // If not using nodeFileSystemApi, provide fs option for gitaware-glob
          if (fileSystemApi !== nodeFileSystemApi) {
            globOptions.fs = fileSystemApi as unknown as FileSystemInterface;
          }

          const files = [];
          for await (const file of gitawareGlob(globPattern, globOptions)) {
            files.push(file);
          }

          // Apply include/exclude globs
          filesToSearch = files.filter((file) => {
            const relFile = relative(rootPath, join(rootPath, file));
            if (pathsExcludeGlob && minimatch(relFile, pathsExcludeGlob)) {
              return false;
            }
            if (pathsIncludeGlob && !minimatch(relFile, pathsIncludeGlob)) {
              return false;
            }
            return true;
          });
        }

        // Search in files
        const results: Record<string, string[]> = {};
        const regex = new RegExp(substringPattern, "gm");

        for (const file of filesToSearch) {
          const filePath = join(rootPath, file);
          const content = await fileSystemApi.readFile(filePath, "utf-8");
          const lines = content.split("\n");
          const matches: string[] = [];

          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              const startLine = Math.max(0, i - contextLinesBefore);
              const endLine = Math.min(lines.length - 1, i + contextLinesAfter);

              const contextLines = [];
              for (let j = startLine; j <= endLine; j++) {
                contextLines.push(`${j + 1}: ${lines[j]}`);
              }

              matches.push(contextLines.join("\n"));
            }
          }

          if (matches.length > 0) {
            results[relative(rootPath, filePath)] = matches;
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
