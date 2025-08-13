import type { Preset } from "../config/schema.ts";
import { LANGUAGE_PATTERNS } from "../config/languagePatterns.ts";

/**
 * F# Autocomplete (fsautocomplete) adapter
 */
export const fsharpAdapter: Preset = {
  presetId: "fsharp",
  bin: "fsautocomplete",
  args: [],
  files: LANGUAGE_PATTERNS.fsharp,
  initializationOptions: {
    AutomaticWorkspaceInit: true,
  },
  disable: ["get_all_diagnostics"],
};
