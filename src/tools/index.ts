export * from "./editor/symbolEditTools.ts";
export * from "./editor/regexEditTools.ts";
export * from "./memory/memoryTools.ts";
// Internal tools - not exported
// export * from "./cacheTools.ts";
// export * from "./workflowTools.ts";
export * from "./finder/fileSystemTools.ts";
export * from "./finder/symbolTools.ts";
export * from "./finder/indexTools.ts";
export * from "./finder/externalLibraryTools.ts";
export * from "./finder/symbolResolverTools.ts";

// Re-export all tools as a collection
import type { McpToolDef } from "@lsmcp/types";
import {
  replaceSymbolBodyTool,
  insertBeforeSymbolTool,
  insertAfterSymbolTool,
} from "./editor/symbolEditTools.ts";
import { replaceRegexTool } from "./editor/regexEditTools.ts";
import {
  listMemoriesTool,
  readMemoryTool,
  writeMemoryTool,
  deleteMemoryTool,
} from "./memory/memoryTools.ts";
// Internal tools - not exported as MCP tools
// import { ... } from "./cacheTools.ts";
// import { ... } from "./workflowTools.ts";
import {
  listDirTool,
  findFileTool,
  searchForPatternTool,
} from "./finder/fileSystemTools.ts";
import {
  getSymbolsOverviewTool,
  querySymbolsTool,
} from "./finder/symbolTools.ts";
import { indexFilesTool } from "./finder/indexTools.ts";
import {
  indexExternalLibrariesToolDef,
  getTypescriptDependenciesToolDef,
  searchExternalLibrarySymbolsToolDef,
} from "./finder/externalLibraryTools.ts";
import { getAdvancedMemoryToolsIfEnabled } from "./memory/advancedMemoryTools.ts";
import {
  resolveSymbolToolDef,
  getAvailableExternalSymbolsToolDef,
  parseImportsToolDef,
} from "./finder/symbolResolverTools.ts";

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

  // Index tools
  indexFiles: indexFilesTool,
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
  // if (config?.languageFeatures?.rust?.enabled) {
  //   Object.assign(tools, languageSpecificTools.rust);
  // }

  // Add advanced memory tools if enabled (support both old and new config)
  const memoryEnabled = config?.experiments?.memory || config?.memoryAdvanced;
  if (memoryEnabled) {
    const advancedMemoryTools = getAdvancedMemoryToolsIfEnabled({
      ...config,
      memoryAdvanced: memoryEnabled,
    });
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
export const serenityToolsList: McpToolDef<any>[] =
  Object.values(serenityTools);

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
