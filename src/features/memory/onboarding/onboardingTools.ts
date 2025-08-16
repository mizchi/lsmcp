/**
 * Onboarding tools for lsmcp symbol indexing
 */

import { z } from "zod";
import type { McpToolDef } from "@internal/types";
import { platform } from "node:os";
import {
  symbolIndexOnboardingPrompt,
  symbolSearchGuidancePrompt,
  compressionAnalysisPrompt,
} from "./onboardingPrompts.ts";

const indexOnboardingSchema = z.object({
  root: z.string().describe("Root directory of the project"),
});

export const indexOnboardingTool: McpToolDef<typeof indexOnboardingSchema> = {
  name: "index_onboarding",
  description: "Get instructions for onboarding the symbol index for a project",
  schema: indexOnboardingSchema,
  execute: async ({ root }) => {
    const systemInfo = `${platform()} ${process.version}`;
    return symbolIndexOnboardingPrompt({ system: systemInfo, rootPath: root });
  },
};

const getSymbolSearchGuidanceSchema = z.object({});

export const getSymbolSearchGuidanceTool: McpToolDef<
  typeof getSymbolSearchGuidanceSchema
> = {
  name: "get_symbol_search_guidance",
  description: "Get guidance on how to effectively search symbols in the index",
  schema: getSymbolSearchGuidanceSchema,
  execute: async () => {
    return symbolSearchGuidancePrompt();
  },
};

const getCompressionGuidanceSchema = z.object({});

export const getCompressionGuidanceTool: McpToolDef<
  typeof getCompressionGuidanceSchema
> = {
  name: "get_compression_guidance",
  description: "Get guidance on token compression analysis",
  schema: getCompressionGuidanceSchema,
  execute: async () => {
    return compressionAnalysisPrompt();
  },
};

// Export all onboarding tools
export const indexOnboardingTools = [
  indexOnboardingTool,
  getSymbolSearchGuidanceTool,
  getCompressionGuidanceTool,
];
