export * from "./symbolEditTools.ts";
export * from "./regexEditTools.ts";
export * from "./memoryTools.ts";
// Internal tools - not exported
// export * from "./cacheTools.ts";
// export * from "./workflowTools.ts";
export * from "./fileSystemTools.ts";
export * from "./symbolTools.ts";
export * from "./indexTools.ts";
export * from "./externalLibraryTools.ts";
export * from "./symbolResolverTools.ts";

// Re-export all tools as a collection
import type { ToolDef } from "../utils/mcpHelpers.ts";
import {
  replaceSymbolBodyTool,
  insertBeforeSymbolTool,
  insertAfterSymbolTool,
} from "./symbolEditTools.ts";
import { replaceRegexTool } from "./regexEditTools.ts";
import {
  listMemoriesTool,
  readMemoryTool,
  writeMemoryTool,
  deleteMemoryTool,
} from "./memoryTools.ts";
// Internal tools - not exported as MCP tools
// import { ... } from "./cacheTools.ts";
// import { ... } from "./workflowTools.ts";
import {
  listDirTool,
  findFileTool,
  searchForPatternTool,
} from "./fileSystemTools.ts";
import { getSymbolsOverviewTool, querySymbolsTool } from "./symbolTools.ts";
import {
  indexExternalLibrariesToolDef,
  getTypescriptDependenciesToolDef,
  searchExternalLibrarySymbolsToolDef,
} from "./externalLibraryTools.ts";
import { getAdvancedMemoryToolsIfEnabled } from "./advancedMemoryTools.ts";
import {
  resolveSymbolToolDef,
  getAvailableExternalSymbolsToolDef,
  parseImportsToolDef,
} from "./symbolResolverTools.ts";

// Core tools that are always available
const coreTools = {
  // Symbol editing tools
  replaceSymbolBody: replaceSymbolBodyTool,
  insertBeforeSymbol: insertBeforeSymbolTool,
  insertAfterSymbol: insertAfterSymbolTool,
  replaceRegex: replaceRegexTool,

  // Memory tools
  listMemories: listMemoriesTool,
  readMemory: readMemoryTool,
  writeMemory: writeMemoryTool,
  deleteMemory: deleteMemoryTool,

  // File system tools
  listDir: listDirTool,
  findFile: findFileTool,
  searchForPattern: searchForPatternTool,

  // Symbol overview tools
  getSymbolsOverview: getSymbolsOverviewTool,
  querySymbols: querySymbolsTool,
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
  // rust: { ... },
  // go: { ... },
  // python: { ... },
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
}): Record<string, ToolDef<any>> {
  const tools = { ...coreTools };

  // Add TypeScript tools if enabled (default: disabled)
  if (config?.languageFeatures?.typescript?.enabled) {
    Object.assign(tools, languageSpecificTools.typescript);
  }

  // Future: Add other language-specific tools based on config
  // if (config?.languageFeatures?.rust?.enabled) {
  //   Object.assign(tools, languageSpecificTools.rust);
  // }

  // Add advanced memory tools if enabled
  if (config?.memoryAdvanced) {
    const advancedMemoryTools = getAdvancedMemoryToolsIfEnabled(config);
    for (const tool of advancedMemoryTools) {
      (tools as any)[tool.name] = tool;
    }
  }

  return tools;
}

// Legacy exports for backward compatibility
export const serenityTools = {
  ...coreTools,
  // External library tools - included for backward compatibility
  // but should be enabled via config in new code
  indexExternalLibraries: indexExternalLibrariesToolDef,
  getTypescriptDependencies: getTypescriptDependenciesToolDef,
  searchExternalLibrarySymbols: searchExternalLibrarySymbolsToolDef,

  // Symbol resolver tools
  resolveSymbol: resolveSymbolToolDef,
  getAvailableExternalSymbols: getAvailableExternalSymbolsToolDef,
  parseImports: parseImportsToolDef,
};

// Export as a list for easy registration
export const serenityToolsList: ToolDef<any>[] = Object.values(serenityTools);

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
}): ToolDef<any>[] {
  const tools = getSerenityTools(config);
  return Object.values(tools);
}
