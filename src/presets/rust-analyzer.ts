import type { Preset } from "../config/schema.ts";
import { LANGUAGE_PATTERNS } from "../config/languagePatterns.ts";

/**
 * rust-analyzer adapter
 */
export const rustAnalyzerAdapter: Preset = {
  presetId: "rust-analyzer",
  bin: "rust-analyzer",
  args: [],
  files: LANGUAGE_PATTERNS.rust,
  initializationOptions: {
    cargo: {
      features: "all",
    },
    // procMacro: {
    //   enable: true,
    // },
  },

  // Language-specific features
  languageFeatures: {
    rust: {
      enabled: true,
      indexCargo: true,
    },
  },
};
