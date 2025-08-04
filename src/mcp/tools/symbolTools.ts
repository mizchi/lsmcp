import { z } from "zod";
import type { ToolDef } from "../utils/mcpHelpers.ts";
import {
  getOrCreateIndex,
  indexFiles,
  querySymbols as queryIndexSymbols,
} from "../../indexer/mcp/IndexerAdapter.ts";
import type { SymbolQuery } from "../../indexer/core/types.ts";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { SymbolKind } from "vscode-languageserver-types";
import { createGitignoreFilter } from "../../core/io/gitignoreUtils.ts";
import { globSync } from "glob";

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

export const getSymbolsOverviewTool: ToolDef<typeof getSymbolsOverviewSchema> =
  {
    name: "get_symbols_overview",
    description:
      "Gets an overview of the given file or directory.\nFor each analyzed file, we list the top-level symbols in the file (name_path, kind).\nUse this tool to get a high-level understanding of the code symbols.\nCalling this is often a good idea before more targeted reading, searching or editing operations on the code symbols.\nBefore requesting a symbol overview, it is usually a good idea to narrow down the scope of the overview\nby first understanding the basic directory structure of the repository that you can get from memories\nor by using the `list_dir` and `find_file` tools (or similar). Returns a JSON object mapping relative paths of all contained files to info about top-level symbols in the file (name_path, kind).",
    schema: getSymbolsOverviewSchema,
    execute: async ({ relativePath, maxAnswerChars = 200000 }) => {
      try {
        const rootPath = process.cwd();
        const absolutePath = resolve(rootPath, relativePath);

        if (!existsSync(absolutePath)) {
          return JSON.stringify({ error: `Path not found: ${relativePath}` });
        }

        // Try to get or create index
        const index = getOrCreateIndex(rootPath);
        if (!index) {
          return JSON.stringify({
            error: "Failed to create symbol index. Make sure LSP is running.",
          });
        }

        const gitignoreFilter = await createGitignoreFilter(rootPath);
        const stats = await import("node:fs/promises").then((fs) =>
          fs.stat(absolutePath),
        );

        const files: string[] = [];

        if (stats.isDirectory()) {
          // Get all code files in directory
          // Normalize the relative path by removing trailing slashes
          const normalizedPath = relativePath.replace(/\/+$/, "");
          const pattern = normalizedPath
            ? `${normalizedPath}/**/*.{ts,tsx,js,jsx,py,java,cpp,c,h,hpp,cs,rb,go,rs,php,swift,kt,scala,r,m,mm}`
            : `**/*.{ts,tsx,js,jsx,py,java,cpp,c,h,hpp,cs,rb,go,rs,php,swift,kt,scala,r,m,mm}`;

          try {
            const foundFiles = globSync(pattern, {
              cwd: rootPath,
              ignore: ["**/node_modules/**", "**/.git/**"],
              nodir: true,
            });

            if (!Array.isArray(foundFiles)) {
              return JSON.stringify({
                error: `globSync returned non-array: ${typeof foundFiles}`,
              });
            }

            const filteredFiles = foundFiles.filter((f) => !gitignoreFilter(f));
            files.push(...filteredFiles);
          } catch (error) {
            return JSON.stringify({
              error: `Glob error: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        } else {
          files.push(relativePath);
        }

        // Index all files first
        if (files.length > 0) {
          const indexResult = await indexFiles(rootPath, files);
          if (!indexResult.success) {
            return JSON.stringify({
              error: `Failed to index files: ${indexResult.errors.map((e) => e.error).join(", ")}`,
            });
          }
        }

        const overview: Record<
          string,
          Array<{ name_path: string; kind: string }>
        > = {};

        for (const file of files) {
          // Query top-level symbols - file parameter expects relative path from root
          const symbols = queryIndexSymbols(rootPath, { file });
          const topLevelSymbols = symbols.filter((s) => !s.containerName);

          overview[file] = topLevelSymbols.map((s) => ({
            name_path: s.name,
            kind: symbolKindToString(s.kind),
          }));
        }

        const output = JSON.stringify(overview, null, 2);
        if (output.length > maxAnswerChars) {
          return JSON.stringify({
            error: `Output too long (${output.length} chars). Try with a more specific path.`,
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

const findSymbolSchema = z.object({
  namePath: z
    .string()
    .describe("The name path pattern to search for, see above for details."),
  relativePath: z
    .string()
    .optional()
    .describe(
      "Optional. Restrict search to this file or directory. If None, searches entire codebase.\nIf a directory is passed, the search will be restricted to the files in that directory.\nIf a file is passed, the search will be restricted to that file.\nIf you have some knowledge about the codebase, you should use this parameter, as it will significantly\nspeed up the search as well as reduce the number of results.",
    ),
  substringMatching: z
    .boolean()
    .default(false)
    .describe(
      "If True, use substring matching for the last segment of `name`.",
    ),
  includeKinds: z
    .array(z.number())
    .optional()
    .describe(
      "Optional. List of LSP symbol kind integers to include. (e.g., 5 for Class, 12 for Function).\nValid kinds: 1=file, 2=module, 3=namespace, 4=package, 5=class, 6=method, 7=property, 8=field, 9=constructor, 10=enum,\n11=interface, 12=function, 13=variable, 14=constant, 15=string, 16=number, 17=boolean, 18=array, 19=object,\n20=key, 21=null, 22=enum member, 23=struct, 24=event, 25=operator, 26=type parameter.",
    ),
  excludeKinds: z
    .array(z.number())
    .optional()
    .describe(
      "Optional. List of LSP symbol kind integers to exclude. Takes precedence over `include_kinds`.",
    ),
  depth: z
    .number()
    .default(0)
    .describe(
      "Depth to retrieve descendants (e.g., 1 for class methods/attributes).",
    ),
  includeBody: z
    .boolean()
    .default(false)
    .describe("If True, include the symbol's source code. Use judiciously."),
  maxAnswerChars: z
    .number()
    .default(200000)
    .describe(
      "Max characters for the JSON result. If exceeded, no content is returned.",
    ),
});

export const findSymbolTool: ToolDef<typeof findSymbolSchema> = {
  name: "find_symbol",
  description:
    'Retrieves information on all symbols/code entities (classes, methods, etc.) based on the given `name_path`,\nwhich represents a pattern for the symbol\'s path within the symbol tree of a single file.\nThe returned symbol location can be used for edits or further queries.\nSpecify `depth > 0` to retrieve children (e.g., methods of a class).\n\nThe matching behavior is determined by the structure of `name_path`, which can\neither be a simple name (e.g. "method") or a name path like "class/method" (relative name path)\nor "/class/method" (absolute name path). Note that the name path is not a path in the file system\nbut rather a path in the symbol tree **within a single file**. Thus, file or directory names should never\nbe included in the `name_path`. For restricting the search to a single file or directory,\nthe `within_relative_path` parameter should be used instead. The retrieved symbols\' `name_path` attribute\nwill always be composed of symbol names, never file or directory names.\n\nKey aspects of the name path matching behavior:\n- Trailing slashes in `name_path` play no role and are ignored.\n- The name of the retrieved symbols will match (either exactly or as a substring)\n  the last segment of `name_path`, while other segments will restrict the search to symbols that\n  have a desired sequence of ancestors.\n- If there is no starting or intermediate slash in `name_path`, there is no\n  restriction on the ancestor symbols. For example, passing `method` will match\n  against symbols with name paths like `method`, `class/method`, `class/nested_class/method`, etc.\n- If `name_path` contains a `/` but doesn\'t start with a `/`, the matching is restricted to symbols\n  with the same ancestors as the last segment of `name_path`. For example, passing `class/method` will match against\n  `class/method` as well as `nested_class/class/method` but not `method`.\n- If `name_path` starts with a `/`, it will be treated as an absolute name path pattern, meaning\n  that the first segment of it must match the first segment of the symbol\'s name path.\n  For example, passing `/class` will match only against top-level symbols like `class` but not against `nested_class/class`.\n  Passing `/class/method` will match against `class/method` but not `nested_class/class/method` or `method`. Returns JSON string: a list of symbols (with locations) matching the name.',
  schema: findSymbolSchema,
  execute: async ({
    namePath,
    relativePath,
    substringMatching = false,
    includeKinds,
    excludeKinds,
    depth: _depth = 0, // TODO: implement depth support
    includeBody: _includeBody = false, // TODO: implement includeBody support
    maxAnswerChars = 200000,
  }) => {
    try {
      const rootPath = process.cwd();

      // Get or create index
      const index = getOrCreateIndex(rootPath);
      if (!index) {
        return JSON.stringify({
          error: "Failed to create symbol index. Make sure LSP is running.",
        });
      }

      // Parse the name path
      const segments = namePath.split("/").filter((s) => s.length > 0);
      if (segments.length === 0) {
        return JSON.stringify({ error: "Empty name path provided" });
      }

      const targetName = segments[segments.length - 1];
      const isAbsolute = namePath.startsWith("/");

      // Build query
      const query: SymbolQuery = {};

      // For substring matching, we'll query all and filter later
      if (!substringMatching) {
        query.name = targetName;
      }

      if (relativePath) {
        query.file = relativePath;
      }

      if (includeKinds) {
        query.kind = includeKinds as SymbolKind[];
      }

      // Query symbols
      let symbols = queryIndexSymbols(rootPath, query);

      // Filter by name pattern
      symbols = symbols.filter((symbol) => {
        // Check name match
        if (substringMatching) {
          if (!symbol.name.includes(targetName)) return false;
        } else {
          if (symbol.name !== targetName) return false;
        }

        // Check path pattern
        if (segments.length > 1) {
          const symbolPath = symbol.containerName
            ? `${symbol.containerName}/${symbol.name}`
            : symbol.name;

          const symbolSegments = symbolPath.split("/");

          if (isAbsolute) {
            // Absolute path - must match from start
            if (segments.length > symbolSegments.length) return false;
            for (let i = 0; i < segments.length; i++) {
              if (segments[i] !== symbolSegments[i]) return false;
            }
          } else {
            // Relative path - find matching subsequence
            let found = false;
            for (let i = 0; i <= symbolSegments.length - segments.length; i++) {
              let match = true;
              for (let j = 0; j < segments.length; j++) {
                if (segments[j] !== symbolSegments[i + j]) {
                  match = false;
                  break;
                }
              }
              if (match) {
                found = true;
                break;
              }
            }
            if (!found) return false;
          }
        }

        return true;
      });

      // Apply exclude kinds filter
      if (excludeKinds) {
        symbols = symbols.filter((s) => !excludeKinds.includes(s.kind));
      }

      // Format results
      const results = symbols.map((symbol) => {
        const result: any = {
          name_path: symbol.containerName
            ? `${symbol.containerName}/${symbol.name}`
            : symbol.name,
          kind: symbolKindToString(symbol.kind),
          location: {
            file: symbol.location.uri
              .replace("file://", "")
              .replace(rootPath + "/", ""),
            line: symbol.location.range.start.line + 1,
            character: symbol.location.range.start.character,
          },
        };

        if (symbol.detail) {
          result.detail = symbol.detail;
        }

        if (symbol.deprecated) {
          result.deprecated = true;
        }

        // TODO: Add support for depth > 0 to include children
        // TODO: Add support for includeBody

        return result;
      });

      const output = JSON.stringify(results, null, 2);
      if (output.length > maxAnswerChars) {
        return JSON.stringify({
          error: `Output too long (${output.length} chars). Try with more specific filters.`,
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

const findReferencingSymbolsSchema = z.object({
  namePath: z
    .string()
    .describe(
      "For finding the symbol to find references for, same logic as in the `find_symbol` tool.",
    ),
  relativePath: z
    .string()
    .describe(
      "The relative path to the file containing the symbol for which to find references.\nNote that here you can't pass a directory but must pass a file.",
    ),
  includeKinds: z
    .array(z.number())
    .optional()
    .describe("Same as in the `find_symbol` tool."),
  excludeKinds: z
    .array(z.number())
    .optional()
    .describe("Same as in the `find_symbol` tool."),
  maxAnswerChars: z
    .number()
    .default(200000)
    .describe("Same as in the `find_symbol` tool."),
});

export const findReferencingSymbolsTool: ToolDef<
  typeof findReferencingSymbolsSchema
> = {
  name: "find_referencing_symbols",
  description:
    "Finds symbols that reference the symbol at the given `name_path`. The result will contain metadata about the referencing symbols\nas well as a short code snippet around the reference (unless `include_body` is True, then the short snippet will be omitted).\nNote that among other kinds of references, this function can be used to find (direct) subclasses of a class,\nas subclasses are referencing symbols that have the kind class. Returns a list of JSON objects with the symbols referencing the requested symbol.",
  schema: findReferencingSymbolsSchema,
  execute: async () => {
    try {
      // This would require LSP findReferences functionality
      // For now, return a placeholder implementation
      return JSON.stringify({
        error:
          "find_referencing_symbols is not yet implemented in lsmcp. Use LSP find references tools instead.",
      });
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

// Helper functions
function symbolKindToString(kind: SymbolKind): string {
  const kinds = {
    [SymbolKind.File]: "file",
    [SymbolKind.Module]: "module",
    [SymbolKind.Namespace]: "namespace",
    [SymbolKind.Package]: "package",
    [SymbolKind.Class]: "class",
    [SymbolKind.Method]: "method",
    [SymbolKind.Property]: "property",
    [SymbolKind.Field]: "field",
    [SymbolKind.Constructor]: "constructor",
    [SymbolKind.Enum]: "enum",
    [SymbolKind.Interface]: "interface",
    [SymbolKind.Function]: "function",
    [SymbolKind.Variable]: "variable",
    [SymbolKind.Constant]: "constant",
    [SymbolKind.String]: "string",
    [SymbolKind.Number]: "number",
    [SymbolKind.Boolean]: "boolean",
    [SymbolKind.Array]: "array",
    [SymbolKind.Object]: "object",
    [SymbolKind.Key]: "key",
    [SymbolKind.Null]: "null",
    [SymbolKind.EnumMember]: "enum_member",
    [SymbolKind.Struct]: "struct",
    [SymbolKind.Event]: "event",
    [SymbolKind.Operator]: "operator",
    [SymbolKind.TypeParameter]: "type_parameter",
  };
  return kinds[kind] || "unknown";
}
