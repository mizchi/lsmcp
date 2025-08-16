export * from "./editor/regexEditTools.ts";
export * from "./editor/rangeEditTools.ts";
export * from "./memory/memoryTools.ts";
// Internal tools - not exported
export * from "./highlevel/fileSystemTools.ts";
export * from "./highlevel/symbolTools.ts";
export * from "./highlevel/indexTools.ts";
export * from "./highlevel/externalLibraryTools.ts";
export * from "./highlevel/symbolResolverTools.ts";

// Re-export all tools as a collection
import type { McpToolDef } from "@internal/types";
import { replaceRegexTool } from "./editor/regexEditTools.ts";
import { replaceRangeTool } from "./editor/rangeEditTools.ts";
import {
  listMemoriesTool,
  readMemoryTool,
  writeMemoryTool,
  deleteMemoryTool,
} from "./memory/memoryTools.ts";
// Internal tools - not exported as MCP tools
import { listDirTool, findFileTool } from "./highlevel/fileSystemTools.ts";
import { getSymbolsOverviewTool } from "./highlevel/symbolTools.ts";
// indexFilesTool removed - using internal indexing functions
import {
  indexExternalLibrariesToolDef,
  getTypescriptDependenciesToolDef,
  searchExternalLibrarySymbolsToolDef,
} from "./highlevel/externalLibraryTools.ts";
import {
  resolveSymbolToolDef,
  getAvailableExternalSymbolsToolDef,
  parseImportsToolDef,
} from "./highlevel/symbolResolverTools.ts";

// Core tools that are always available
const coreTools = {
  // Range and regex editing tools
  replaceRange: replaceRangeTool,
  replaceRegex: replaceRegexTool,

  // Memory tools
  listMemories: listMemoriesTool,
  readMemory: readMemoryTool,
  writeMemory: writeMemoryTool,
  deleteMemory: deleteMemoryTool,

  // File system tools
  listDir: listDirTool,
  findFile: findFileTool,

  // Symbol overview tools
  getSymbolsOverview: getSymbolsOverviewTool,
  // querySymbols removed - functionality now in search_symbols tool

  // Index tools removed - indexing is now automatic
};

// Language-specific tools
const languageSpecificTools = {
  typescript: {
    indexExternalLibraries: indexExternalLibrariesToolDef,
    getTypescriptDependencies: getTypescriptDependenciesToolDef,
    searchExternalLibrarySymbols: searchExternalLibrarySymbolsToolDef,
    resolveSymbol: resolveSymbolToolDef,
    getAvailableExternalSymbols: getAvailableExternalSymbolsToolDef,
    parseImports: parseImportsToolDef,
  },
  // Future language-specific tools can be added here
};

/**
 * Get Serenity tools based on configuration
 */
export function getSerenityTools(config?: {
  languageFeatures?: {
    typescript?: { enabled: boolean };
    rust?: { enabled: boolean };
    go?: { enabled: boolean };
    python?: { enabled: boolean };
  };
  memoryAdvanced?: boolean;
  experiments?: {
    memory?: boolean;
  };
}): Record<string, McpToolDef<any>> {
  const tools = { ...coreTools };

  // Add TypeScript tools if enabled (default: disabled)
  if (config?.languageFeatures?.typescript?.enabled) {
    Object.assign(tools, languageSpecificTools.typescript);
  }

  // Future: Add other language-specific tools based on config

  // Add advanced memory tools if enabled (support both old and new config)
  // const memoryEnabled = config?.experiments?.memory || config?.memoryAdvanced;
  // if (memoryEnabled) {
  //   const advancedMemoryTools = getAdvancedMemoryToolsIfEnabled({
  //     ...config,
  //     memoryAdvanced: memoryEnabled,
  //   });
  //   for (const tool of advancedMemoryTools) {
  //     (tools as any)[tool.name] = tool;
  //   }
  // }

  return tools;
}

/**
 * Get Serenity tools list based on configuration
 */
export function getSerenityToolsList(config?: {
  languageFeatures?: {
    typescript?: { enabled: boolean };
    rust?: { enabled: boolean };
    go?: { enabled: boolean };
    python?: { enabled: boolean };
  };
  memoryAdvanced?: boolean;
  experiments?: {
    memory?: boolean;
  };
}): McpToolDef<any>[] {
  const tools = getSerenityTools(config);
  return Object.values(tools);
}
