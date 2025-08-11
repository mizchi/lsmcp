/**
 * MCP tools for external library indexing
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolDef } from "../utils/mcpHelpers.ts";
import { z } from "zod";
import { resolve } from "path";
import {
  getSymbolIndex,
  indexExternalLibrariesForState,
  getTypescriptDependencies,
  queryExternalLibrarySymbols,
  getSymbolKindName,
} from "@lsmcp/code-indexer";
import type { ExternalLibraryConfig } from "@lsmcp/code-indexer";

/**
 * Tool: Index external libraries (node_modules)
 */
export const indexExternalLibrariesTool: Tool = {
  name: "index_external_libraries",
  description: `Index TypeScript declaration files from node_modules to enable symbol search in external dependencies.
This tool scans node_modules for .d.ts files and indexes their symbols for fast searching.`,
  inputSchema: {
    type: "object",
    properties: {
      root: {
        type: "string",
        description: "Root directory of the project",
      },
      maxFiles: {
        type: "number",
        description: "Maximum number of files to index (default: 5000)",
      },
      includePatterns: {
        type: "array",
        items: { type: "string" },
        description:
          "Glob patterns for files to include (default: ['node_modules/**/*.d.ts'])",
      },
      excludePatterns: {
        type: "array",
        items: { type: "string" },
        description: "Glob patterns for files to exclude",
      },
    },
    required: ["root"],
  },
};

/**
 * Tool: Get TypeScript dependencies
 */
export const getTypescriptDependenciesTool: Tool = {
  name: "get_typescript_dependencies",
  description: `List all TypeScript dependencies available in the project (from package.json and node_modules).
Shows which external libraries have TypeScript declarations that can be indexed.`,
  inputSchema: {
    type: "object",
    properties: {
      root: {
        type: "string",
        description: "Root directory of the project",
      },
    },
    required: ["root"],
  },
};

/**
 * Tool: Search external library symbols
 */
export const searchExternalLibrarySymbolsTool: Tool = {
  name: "search_external_library_symbols",
  description: `Search for symbols in indexed external libraries (node_modules).
Requires running index_external_libraries first.`,
  inputSchema: {
    type: "object",
    properties: {
      root: {
        type: "string",
        description: "Root directory of the project",
      },
      libraryName: {
        type: "string",
        description:
          "Name of the library to search in (e.g., 'react', '@types/node'). If not specified, searches all libraries.",
      },
      symbolName: {
        type: "string",
        description:
          "Name of the symbol to search for (supports partial matching)",
      },
      kind: {
        type: "string",
        enum: [
          "Class",
          "Interface",
          "Function",
          "Variable",
          "Constant",
          "Enum",
          "Module",
          "Namespace",
          "TypeParameter",
        ],
        description: "Type of symbol to filter by",
      },
    },
    required: ["root"],
  },
};

/**
 * Handle index_external_libraries tool
 */
export async function handleIndexExternalLibraries(args: any) {
  const schema = z.object({
    root: z.string(),
    maxFiles: z.number().optional(),
    includePatterns: z.array(z.string()).optional(),
    excludePatterns: z.array(z.string()).optional(),
  });

  const parsed = schema.parse(args);
  const rootPath = resolve(parsed.root);
  const state = getSymbolIndex(rootPath);

  if (!state.client) {
    throw new Error(
      "LSP client not initialized. Please initialize the index first.",
    );
  }

  const config: Partial<ExternalLibraryConfig> = {
    maxFiles: parsed.maxFiles,
    includePatterns: parsed.includePatterns,
    excludePatterns: parsed.excludePatterns,
  };

  const result = await indexExternalLibrariesForState(state, config);

  // Convert libraries Map to array with explicit iteration to avoid TS inference issues
  const librariesArray: Array<{
    name: string;
    version?: string;
    filesCount: number;
  }> = [];
  for (const [name, info] of result.libraries as unknown as Iterable<
    [string, any]
  >) {
    librariesArray.push({
      name,
      version: info?.version,
      filesCount: Array.isArray(info?.typingsFiles)
        ? info.typingsFiles.length
        : 0,
    });
  }

  return JSON.stringify(
    {
      librariesIndexed: result.libraries.size,
      filesIndexed: result.files.length,
      totalSymbols: result.totalSymbols,
      indexingTime: `${result.indexingTime}ms`,
      libraries: librariesArray,
    },
    null,
    2,
  );
}

/**
 * Handle get_typescript_dependencies tool
 */
export async function handleGetTypescriptDependencies(args: any) {
  const schema = z.object({
    root: z.string(),
  });

  const parsed = schema.parse(args);
  const rootPath = resolve(parsed.root);
  const state = getSymbolIndex(rootPath);

  const dependencies = await getTypescriptDependencies(state);

  return JSON.stringify(
    {
      totalDependencies: dependencies.length,
      dependencies: dependencies.sort(),
    },
    null,
    2,
  );
}

/**
 * Handle search_external_library_symbols tool
 */
export async function handleSearchExternalLibrarySymbols(args: any) {
  const schema = z.object({
    root: z.string(),
    libraryName: z.string().optional(),
    symbolName: z.string().optional(),
    kind: z
      .enum([
        "Class",
        "Interface",
        "Function",
        "Variable",
        "Constant",
        "Enum",
        "Module",
        "Namespace",
        "TypeParameter",
      ])
      .optional(),
  });

  const parsed = schema.parse(args);
  const rootPath = resolve(parsed.root);
  const state = getSymbolIndex(rootPath);

  if (!state.externalLibraries) {
    throw new Error(
      "External libraries not indexed. Please run index_external_libraries first.",
    );
  }

  let symbols = queryExternalLibrarySymbols(state, parsed.libraryName);

  // Filter by symbol name if provided
  if (parsed.symbolName) {
    const searchName = parsed.symbolName.toLowerCase();
    symbols = symbols.filter((s) => s.name.toLowerCase().includes(searchName));
  }

  // Filter by kind if provided
  if (parsed.kind) {
    const kindMap: Record<string, number> = {
      Class: 5,
      Interface: 11,
      Function: 12,
      Variable: 13,
      Constant: 14,
      Enum: 10,
      Module: 2,
      Namespace: 3,
      TypeParameter: 26,
    };
    const targetKind = kindMap[parsed.kind];
    if (targetKind !== undefined) {
      symbols = symbols.filter((s) => s.kind === targetKind);
    }
  }

  // Limit results for readability
  const maxResults = 100;
  const truncated = symbols.length > maxResults;
  const displaySymbols = symbols.slice(0, maxResults);

  return JSON.stringify(
    {
      totalResults: symbols.length,
      displayed: displaySymbols.length,
      truncated,
      symbols: displaySymbols.map((s) => ({
        name: s.name,
        kind: getSymbolKindName(s.kind),
        container: s.containerName,
        file: s.location.uri.replace("file://", ""),
        detail: s.detail,
      })),
    },
    null,
    2,
  );
}

/**
 * Get all external library tools
 * @deprecated Use getExternalLibraryToolsWithConfig instead
 */
export function getExternalLibraryTools(): Tool[] {
  return [
    indexExternalLibrariesTool,
    getTypescriptDependenciesTool,
    searchExternalLibrarySymbolsTool,
  ];
}

/**
 * Get external library tools based on configuration
 */
export function getExternalLibraryToolsWithConfig(config?: {
  typescript?: { enabled: boolean };
  rust?: { enabled: boolean };
  go?: { enabled: boolean };
  python?: { enabled: boolean };
}): Tool[] {
  const tools: Tool[] = [];

  // Default to TypeScript enabled if no config provided
  const typescriptEnabled = config?.typescript?.enabled ?? false;
  // const rustEnabled = config?.rust?.enabled ?? false;
  // const goEnabled = config?.go?.enabled ?? false;
  // const pythonEnabled = config?.python?.enabled ?? false;

  // Only add TypeScript tools if enabled
  if (typescriptEnabled) {
    tools.push(
      indexExternalLibrariesTool,
      getTypescriptDependenciesTool,
      searchExternalLibrarySymbolsTool,
    );
  }

  // Future: Add Rust-specific tools when enabled
  // if (rustEnabled) {
  //   tools.push(indexRustCratesTool, searchRustSymbolsTool);
  // }

  // Future: Add Go-specific tools when enabled
  // if (goEnabled) {
  //   tools.push(indexGoModulesTool, searchGoSymbolsTool);
  // }

  // Future: Add Python-specific tools when enabled
  // if (pythonEnabled) {
  //   tools.push(indexPythonPackagesTool, searchPythonSymbolsTool);
  // }

  return tools;
}

/**
 * Export tools as ToolDef for MCP registration
 */

export const indexExternalLibrariesToolDef: ToolDef<any> = {
  name: "index_external_libraries",
  description: `Index TypeScript declaration files from node_modules to enable symbol search in external dependencies.
This tool scans node_modules for .d.ts files and indexes their symbols for fast searching.`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    maxFiles: z
      .number()
      .optional()
      .describe("Maximum number of files to index (default: 5000)"),
    includePatterns: z
      .array(z.string())
      .optional()
      .describe("Glob patterns for files to include"),
    excludePatterns: z
      .array(z.string())
      .optional()
      .describe("Glob patterns for files to exclude"),
  }),
  execute: handleIndexExternalLibraries,
};

export const getTypescriptDependenciesToolDef: ToolDef<any> = {
  name: "get_typescript_dependencies",
  description: `List all TypeScript dependencies available in the project (from package.json and node_modules).
Shows which external libraries have TypeScript declarations that can be indexed.`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
  }),
  execute: handleGetTypescriptDependencies,
};

export const searchExternalLibrarySymbolsToolDef: ToolDef<any> = {
  name: "search_external_library_symbols",
  description: `Search for symbols in indexed external libraries (node_modules).
Requires running index_external_libraries first.`,
  schema: z.object({
    root: z.string().describe("Root directory of the project"),
    libraryName: z
      .string()
      .optional()
      .describe("Name of the library to search in"),
    symbolName: z
      .string()
      .optional()
      .describe("Name of the symbol to search for"),
    kind: z
      .enum([
        "Class",
        "Interface",
        "Function",
        "Variable",
        "Constant",
        "Enum",
        "Module",
        "Namespace",
        "TypeParameter",
      ])
      .optional()
      .describe("Type of symbol to filter by"),
  }),
  execute: handleSearchExternalLibrarySymbols,
};
