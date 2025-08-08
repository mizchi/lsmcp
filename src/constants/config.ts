/**
 * Configuration-related constants
 */

// Re-export default config from existing location
export { DEFAULT_CONFIG } from "../config/schema/configSchema.ts";

// Config file paths
export const CONFIG_FILE_NAME = "config.json";
export const CONFIG_DIR_NAME = ".lsmcp";
export const MEMORIES_DIR_NAME = "memories";

// Memory templates
export const DEFAULT_MEMORY_TEMPLATES = {
  projectOverview: "project_overview.md",
  codeStyleConventions: "code_style_conventions.md",
  taskCompletionChecklist: "task_completion_checklist.md",
} as const;
