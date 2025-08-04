import { z } from "zod";
import type { ToolDef } from "../utils/mcpHelpers.ts";
import { platform } from "node:os";
import {
  onboardingPrompt,
  thinkAboutCollectedInformationPrompt,
  thinkAboutTaskAdherencePrompt,
  thinkAboutWhetherYouAreDonePrompt,
} from "../../prompts/workflow.ts";

const checkOnboardingPerformedSchema = z.object({});

export const checkOnboardingPerformedTool: ToolDef<
  typeof checkOnboardingPerformedSchema
> = {
  name: "check_onboarding_performed",
  description:
    "Checks whether project onboarding was already performed.\nYou should always call this tool before beginning to actually work on the project/after activating a project,\nbut after calling the initial instructions tool.",
  schema: checkOnboardingPerformedSchema,
  execute: async () => {
    // Check if .serena/memories directory exists with memory files
    const { existsSync } = await import("node:fs");
    const { join } = await import("node:path");

    const memoriesPath = join(process.cwd(), ".serena", "memories");
    const hasMemories =
      existsSync(memoriesPath) &&
      existsSync(join(memoriesPath, "suggested_commands.md"));

    return JSON.stringify({
      onboardingPerformed: hasMemories,
      message: hasMemories
        ? "Onboarding has been performed. Memories are available."
        : "Onboarding not yet performed. You should run the onboarding tool.",
    });
  },
};

const onboardingSchema = z.object({});

export const onboardingTool: ToolDef<typeof onboardingSchema> = {
  name: "onboarding",
  description:
    "Call this tool if onboarding was not performed yet.\nYou will call this tool at most once per conversation. Returns instructions on how to create the onboarding information.",
  schema: onboardingSchema,
  execute: async () => {
    const systemInfo = `${platform()} ${process.version}`;
    const prompt = onboardingPrompt({ system: systemInfo });

    return prompt;
  },
};

const thinkAboutCollectedInformationSchema = z.object({});

export const thinkAboutCollectedInformationTool: ToolDef<
  typeof thinkAboutCollectedInformationSchema
> = {
  name: "think_about_collected_information",
  description:
    "Think about the collected information and whether it is sufficient and relevant.\nThis tool should ALWAYS be called after you have completed a non-trivial sequence of searching steps like\nfind_symbol, find_referencing_symbols, search_files_for_pattern, read_file, etc.",
  schema: thinkAboutCollectedInformationSchema,
  execute: async () => {
    return thinkAboutCollectedInformationPrompt();
  },
};

const thinkAboutTaskAdherenceSchema = z.object({});

export const thinkAboutTaskAdherenceTool: ToolDef<
  typeof thinkAboutTaskAdherenceSchema
> = {
  name: "think_about_task_adherence",
  description:
    "Think about the task at hand and whether you are still on track.\nEspecially important if the conversation has been going on for a while and there\nhas been a lot of back and forth.\n\nThis tool should ALWAYS be called before you insert, replace, or delete code.",
  schema: thinkAboutTaskAdherenceSchema,
  execute: async () => {
    return thinkAboutTaskAdherencePrompt();
  },
};

const thinkAboutWhetherYouAreDoneSchema = z.object({});

export const thinkAboutWhetherYouAreDoneTool: ToolDef<
  typeof thinkAboutWhetherYouAreDoneSchema
> = {
  name: "think_about_whether_you_are_done",
  description:
    "Whenever you feel that you are done with what the user has asked for, it is important to call this tool.",
  schema: thinkAboutWhetherYouAreDoneSchema,
  execute: async () => {
    return thinkAboutWhetherYouAreDonePrompt();
  },
};

const switchModesSchema = z.object({
  modes: z.array(z.string()).describe("The names of the modes to activate."),
});

export const switchModesTool: ToolDef<typeof switchModesSchema> = {
  name: "switch_modes",
  description:
    'Activates the desired modes, like ["editing", "interactive"] or ["planning", "one-shot"].',
  schema: switchModesSchema,
  execute: async ({ modes }) => {
    // This would be integrated with the actual mode system
    // For now, just return acknowledgment
    return JSON.stringify({
      success: true,
      activeModes: modes,
      message: `Switched to modes: ${modes.join(", ")}`,
    });
  },
};
