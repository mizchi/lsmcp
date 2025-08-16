/**
 * Tool list exports
 */

import type { McpToolDef } from "@internal/types";

// Import analysis tools
import { indexTools } from "./highlevel/indexTools.ts";

// Import serenity tools
import { getSerenityToolsList } from "./index.ts";

// Import onboarding tools
import { indexOnboardingTools } from "../features/memory/onboarding/onboardingTools.ts";

// Define high-level analysis tools (not affected by LSP capabilities)
export const highLevelTools: McpToolDef<any>[] = [
  ...indexTools, // Includes search_symbols and get_project_overview
];

// Define serenity tools (use function to get proper tools list)
export const serenityToolsList: McpToolDef<any>[] = getSerenityToolsList();

// Define onboarding tools
export const onboardingToolsList: McpToolDef<any>[] = indexOnboardingTools;
