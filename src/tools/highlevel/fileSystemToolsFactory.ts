import { z } from "zod";
import { join, relative } from "node:path";
import { glob as gitawareGlob, type FileSystemInterface } from "gitaware-glob";
import type { FileSystemApi } from "@internal/types";
import { nodeFileSystemApi } from "../../infrastructure/NodeFileSystemApi.ts";
import type { McpToolDef } from "@internal/types";

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

        // Collect files
        for await (const path of gitawareGlob(globPattern, globOptions)) {
          const isDirectory = path.endsWith("/");
          const cleanPath = isDirectory ? path.slice(0, -1) : path;

          if (isDirectory) {
            result.directories.push(cleanPath);
          } else {
            result.files.push(cleanPath);
          }
        }

        // For non-recursive mode, also explicitly check for directories
        if (!recursive) {
          const entries = await fileSystemApi.readdir(absolutePath);
          for (const entry of entries) {
            const entryPath = join(absolutePath, entry);
            const stats = await fileSystemApi.stat(entryPath);
            if (stats.isDirectory()) {
              const relativeDirPath = join(relativePath, entry);
              // Check if not already in the list and not gitignored
              if (!result.directories.includes(relativeDirPath)) {
                // Skip common ignored directories
                const ignoredDirs = [
                  "node_modules",
                  ".git",
                  "dist",
                  "build",
                  ".next",
                  ".nuxt",
                  "coverage",
                ];
                if (!ignoredDirs.includes(entry) && !entry.startsWith(".")) {
                  result.directories.push(relativeDirPath);
                }
              }
            }
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
