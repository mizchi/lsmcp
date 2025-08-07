export * from "./symbolEditTools.ts";
export * from "./regexEditTools.ts";
export * from "./memoryTools.ts";
// Internal tools - not exported
// export * from "./cacheTools.ts";
// export * from "./workflowTools.ts";
export * from "./fileSystemTools.ts";
export * from "./symbolTools.ts";
export * from "./indexTools.ts";

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

export const serenityTools = {
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

  // Internal tools removed - not for MCP exposure:
  // - searchCachedSymbols
  // - getCacheStats
  // - clearCache
  // - checkOnboardingPerformed
  // - onboarding
  // - thinkAboutCollectedInformation
  // - thinkAboutTaskAdherence
  // - thinkAboutWhetherYouAreDone
};

// Export as a list for easy registration
export const serenityToolsList: ToolDef<any>[] = Object.values(serenityTools);
