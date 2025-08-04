export * from "./symbolEditTools.ts";
export * from "./regexEditTools.ts";
export * from "./memoryTools.ts";
export * from "./cacheTools.ts";
export * from "./workflowTools.ts";
export * from "./fileSystemTools.ts";
export * from "./symbolTools.ts";
export * from "./compressionTools.ts";
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
import {
  searchCachedSymbolsFromIndexTool,
  getCacheStatsFromIndexTool,
  clearCacheFromIndexTool,
} from "./cacheTools.ts";
import {
  checkOnboardingPerformedTool,
  onboardingTool,
  thinkAboutCollectedInformationTool,
  thinkAboutTaskAdherenceTool,
  thinkAboutWhetherYouAreDoneTool,
} from "./workflowTools.ts";
import {
  listDirTool,
  findFileTool,
  searchForPatternTool,
} from "./fileSystemTools.ts";
import {
  getSymbolsOverviewTool,
  findSymbolTool,
  findReferencingSymbolsTool,
} from "./symbolTools.ts";

export const serenityTools = {
  replaceSymbolBody: replaceSymbolBodyTool,
  insertBeforeSymbol: insertBeforeSymbolTool,
  insertAfterSymbol: insertAfterSymbolTool,
  replaceRegex: replaceRegexTool,
  listMemories: listMemoriesTool,
  readMemory: readMemoryTool,
  writeMemory: writeMemoryTool,
  deleteMemory: deleteMemoryTool,
  searchCachedSymbols: searchCachedSymbolsFromIndexTool,
  getCacheStats: getCacheStatsFromIndexTool,
  clearCache: clearCacheFromIndexTool,
  checkOnboardingPerformed: checkOnboardingPerformedTool,
  onboarding: onboardingTool,
  thinkAboutCollectedInformation: thinkAboutCollectedInformationTool,
  thinkAboutTaskAdherence: thinkAboutTaskAdherenceTool,
  thinkAboutWhetherYouAreDone: thinkAboutWhetherYouAreDoneTool,
  listDir: listDirTool,
  findFile: findFileTool,
  searchForPattern: searchForPatternTool,
  getSymbolsOverview: getSymbolsOverviewTool,
  findSymbol: findSymbolTool,
  findReferencingSymbols: findReferencingSymbolsTool,
};

// Export as a list for easy registration
export const serenityToolsList: ToolDef<any>[] = Object.values(serenityTools);
