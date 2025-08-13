import type { Preset } from "../types/lsp.ts";

/**
 * MoonBit language server adapter
 *
 * Known issues:
 * - May have slower response times for some operations
 * - Hover operations may timeout on large files
 */
export const moonbitAdapter: Preset = {
  presetId: "moonbit",
  bin: "moonbit-lsp",
  args: [],
  files: ["**/*.mbt", "**/*.mbti"],
  disable: [
    // "get_hover", // May be slow/timeout on some files
  ],
};
