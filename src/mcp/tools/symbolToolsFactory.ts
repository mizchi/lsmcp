import { z } from "zod";
import type { ToolDef } from "../utils/mcpHelpers.ts";
import {
  getOrCreateIndex,
  indexFiles,
  querySymbols as queryIndexSymbols,
} from "../../indexer/mcp/IndexerAdapter.ts";
import type { SymbolQuery } from "../../indexer/engine/types.ts";
import { resolve } from "node:path";
import { SymbolKind } from "vscode-languageserver-types";
import { glob, type FileSystemInterface } from "gitaware-glob";
import type { FileSystemApi } from "../../filesystem/api/FileSystemApi.ts";
import { nodeFileSystemApi } from "../../filesystem/node/NodeFileSystemApi.ts";

// Export for testing
export async function getFilesRecursively(
  dir: string,
  rootPath: string,
  fileSystemApi: FileSystemApi = nodeFileSystemApi,
): Promise<string[]> {
  const extensions = [
    "ts",
    "tsx",
    "js",
    "jsx",
    "py",
    "java",
    "cpp",
    "c",
    "h",
    "hpp",
    "cs",
    "rb",
    "go",
    "rs",
    "php",
    "swift",
    "kt",
    "scala",
    "r",
    "m",
    "mm",
    "fs",
    "fsx",
    "ml",
    "mli",
  ];

  // Use gitaware-glob for file discovery
  const pattern = `**/*.{${extensions.join(",")}}`;

  const globOptions: {
    cwd: string;
    fs?: FileSystemInterface;
  } = {
    cwd: dir,
  };

  // If not using nodeFileSystemApi, provide fs option for gitaware-glob
  if (fileSystemApi !== nodeFileSystemApi) {
    globOptions.fs = fileSystemApi as unknown as FileSystemInterface;
  }

  const files = [];
  for await (const file of glob(pattern, globOptions)) {
    files.push(file);
  }

  // Convert to relative paths from rootPath
  return files.map((file) => {
    const fullPath = resolve(dir, file);
    return fullPath.startsWith(rootPath + "/")
      ? fullPath.substring(rootPath.length + 1)
      : fullPath.replace(rootPath, "").replace(/^\//, "");
  });
}

const getSymbolsOverviewSchema = z.object({
  relativePath: z
    .string()
    .describe(
      "The relative path to the file or directory to get the overview of.",
    ),
  maxAnswerChars: z
    .number()
    .default(200000)
    .describe(
      "If the overview is longer than this number of characters,\nno content will be returned. Don't adjust unless there is really no other way to get the content\nrequired for the task. If the overview is too long, you should use a smaller directory instead,\n(e.g. a subdirectory).",
    ),
});

export function createGetSymbolsOverviewTool(
  fileSystemApi: FileSystemApi = nodeFileSystemApi,
): ToolDef<typeof getSymbolsOverviewSchema> {
  return {
    name: "get_symbols_overview",
    description:
      "Gets an overview of the given file or directory.\nFor each analyzed file, we list the top-level symbols in the file (name_path, kind).\nUse this tool to get a high-level understanding of the code symbols.\nCalling this is often a good idea before more targeted reading, searching or editing operations on the code symbols.\nBefore requesting a symbol overview, it is usually a good idea to narrow down the scope of the overview\nby first understanding the basic directory structure of the repository that you can get from memories\nor by using the `list_dir` and `find_file` tools (or similar). Returns a JSON object mapping relative paths of all contained files to info about top-level symbols in the file (name_path, kind).",
    schema: getSymbolsOverviewSchema,
    execute: async ({ relativePath, maxAnswerChars = 200000 }) => {
      try {
        const rootPath = process.cwd();
        const absolutePath = resolve(rootPath, relativePath);

        if (!(await fileSystemApi.exists(absolutePath))) {
          return JSON.stringify({ error: `Path not found: ${relativePath}` });
        }

        // Try to get or create index
        const index = getOrCreateIndex(rootPath);
        if (!index) {
          return JSON.stringify({
            error: "Failed to create symbol index. Make sure LSP is running.",
          });
        }

        // Check if it's a file or directory
        const stats = await fileSystemApi.stat(absolutePath);
        const isDirectory = stats.isDirectory();

        let filesToIndex: string[] = [];

        if (isDirectory) {
          // Get all code files in the directory
          filesToIndex = await getFilesRecursively(
            absolutePath,
            rootPath,
            fileSystemApi,
          );
          if (filesToIndex.length === 0) {
            return JSON.stringify({
              error: `No files found in ${relativePath}`,
            });
          }
        } else {
          // Single file
          filesToIndex = [relativePath];
        }

        // Index the files
        const indexResult = await indexFiles(rootPath, filesToIndex);

        if (!indexResult.success && indexResult.errors.length > 0) {
          return JSON.stringify({
            error: `Failed to index files: ${indexResult.errors.join(", ")}`,
          });
        }

        // Query symbols for each file
        const result: Record<
          string,
          Array<{ name_path: string; kind: string }>
        > = {};

        for (const file of filesToIndex) {
          const query: SymbolQuery = {
            file,
            includeChildren: false, // Only top-level symbols
          };

          const symbols = queryIndexSymbols(rootPath, query);

          // Convert to simplified format
          result[file] = symbols.map((symbol) => {
            // Find the string key for the numeric SymbolKind value
            const kindKey = Object.entries(SymbolKind).find(
              ([_, value]) => value === symbol.kind,
            )?.[0];

            return {
              name_path: symbol.containerName
                ? `${symbol.containerName}/${symbol.name}`
                : symbol.name,
              kind: kindKey?.toLowerCase() || "unknown",
            };
          });
        }

        const output = JSON.stringify(result, null, 2);
        if (output.length > maxAnswerChars) {
          return JSON.stringify({
            error: `Output too long (${output.length} chars). Try with a smaller directory or file.`,
          });
        }

        return output;
      } catch (error) {
        console.error("Directory scan error:", error);
        return JSON.stringify({
          error: `Directory scan error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  };
}

const querySymbolsSchema = z.object({
  name: z
    .string()
    .optional()
    .describe("Symbol name to search for (supports partial matching)"),
  kind: z
    .string()
    .optional()
    .describe("Symbol kind (e.g., 'function', 'class', 'variable')"),
  file: z
    .string()
    .optional()
    .describe("File path to search within (relative to root)"),
  containerName: z
    .string()
    .optional()
    .describe("Container name (e.g., class name for methods)"),
  includeChildren: z
    .boolean()
    .default(true)
    .describe("Include child symbols in results"),
});

export function createQuerySymbolsTool(
  _fileSystemApi: FileSystemApi = nodeFileSystemApi,
): ToolDef<typeof querySymbolsSchema> {
  return {
    name: "query_symbols",
    description:
      "Query symbols from the symbol index. Use this to find symbols by name, kind, or location.",
    schema: querySymbolsSchema,
    execute: async ({ name, kind, file, containerName, includeChildren }) => {
      try {
        const rootPath = process.cwd();
        const index = getOrCreateIndex(rootPath);
        if (!index) {
          return JSON.stringify({
            error: "Failed to get symbol index. Make sure LSP is running.",
          });
        }

        // Convert kind string to SymbolKind enum if provided
        let kindEnum: SymbolKind | undefined;
        if (kind) {
          const kindKey = Object.keys(SymbolKind).find(
            (k) => k.toLowerCase() === kind.toLowerCase(),
          );
          if (kindKey) {
            kindEnum = (SymbolKind as any)[kindKey];
          }
        }

        const query: SymbolQuery = {
          name,
          kind: kindEnum,
          file,
          containerName,
          includeChildren,
        };

        const symbols = queryIndexSymbols(rootPath, query);

        return JSON.stringify(symbols, null, 2);
      } catch (error) {
        return JSON.stringify({
          error: `Query error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  };
}
