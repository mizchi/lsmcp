/**
 * Onboarding tools for lsmcp symbol indexing
 */

import { z } from "zod";
import type { ToolDef } from "../../../utils/mcpHelpers.ts";
import { platform } from "node:os";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  symbolIndexOnboardingPrompt,
  symbolSearchGuidancePrompt,
  compressionAnalysisPrompt,
} from "./onboardingPrompts.ts";

const checkIndexOnboardingSchema = z.object({
  root: z.string().describe("Root directory of the project"),
});

export const checkIndexOnboardingTool: ToolDef<
  typeof checkIndexOnboardingSchema
> = {
  name: "check_index_onboarding",
  description:
    "Check if symbol index onboarding has been performed for this project",
  schema: checkIndexOnboardingSchema,
  execute: async ({ root }) => {
    // Check if .lsmcp/memories directory exists
    const memoriesPath = join(root, ".lsmcp", "memories");
    const indexMemoryPath = join(memoriesPath, "symbol_index_info.md");

    const hasOnboarding =
      existsSync(memoriesPath) && existsSync(indexMemoryPath);

    return JSON.stringify({
      onboardingPerformed: hasOnboarding,
      memoriesPath,
      message: hasOnboarding
        ? "Symbol index onboarding completed. Index information available."
        : "Symbol index onboarding not performed. Run index_onboarding tool.",
    });
  },
};

const indexOnboardingSchema = z.object({
  root: z.string().describe("Root directory of the project"),
});

export const indexOnboardingTool: ToolDef<typeof indexOnboardingSchema> = {
  name: "index_onboarding",
  description: "Get instructions for onboarding the symbol index for a project",
  schema: indexOnboardingSchema,
  execute: async ({ root }) => {
    const systemInfo = `${platform()} ${process.version}`;
    return symbolIndexOnboardingPrompt({ system: systemInfo, rootPath: root });
  },
};

const getSymbolSearchGuidanceSchema = z.object({});

export const getSymbolSearchGuidanceTool: ToolDef<
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

export const getCompressionGuidanceTool: ToolDef<
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
  checkIndexOnboardingTool,
  indexOnboardingTool,
  getSymbolSearchGuidanceTool,
  getCompressionGuidanceTool,
];
