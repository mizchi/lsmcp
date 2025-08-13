/**
 * Tool list exports
 */

import type { McpToolDef } from "@lsmcp/types";

// Import analysis tools
import { indexTools } from "./finder/indexTools.ts";

// Import serenity tools
import { serenityTools } from "./index.ts";

// Import onboarding tools
import { indexOnboardingTools } from "../features/memory/onboarding/onboardingTools.ts";

// Define high-level analysis tools (not affected by LSP capabilities)
export const highLevelTools: McpToolDef<any>[] = [...indexTools];

// Define serenity tools
export const serenityToolsList: McpToolDef<any>[] =
  Object.values(serenityTools);

// Define onboarding tools
export const onboardingToolsList: McpToolDef<any>[] = indexOnboardingTools;
