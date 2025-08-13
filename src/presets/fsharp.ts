import type { Preset } from "../config/schema.ts";

/**
 * F# Autocomplete (fsautocomplete) adapter
 */
export const fsharpAdapter: Preset = {
  presetId: "fsharp",
  bin: "fsautocomplete",
  args: [],
  files: ["**/*.fs", "**/*.fsi", "**/*.fsx"],
  initializationOptions: {
    AutomaticWorkspaceInit: true,
  },
  disable: ["get_all_diagnostics"],
};
