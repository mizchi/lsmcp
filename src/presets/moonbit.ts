import type { Preset } from "../config/schema.ts";

/**
 * MoonBit language server adapter
 *
 * Known issues:
 * - May have slower response times for some operations
 * - Hover operations may timeout on large files
 */
export const moonbitAdapter: Preset = {
  presetId: "moonbit",
  bin: "moonbit",
  args: ["lsp"],
  files: ["**/*.mbt", "**/*.mbti"],
  binFindStrategy: {
    strategies: [{ type: "global", names: ["moonbit"] }],
  },
  disable: [
    // "get_hover", // May be slow/timeout on some files
  ],
};
