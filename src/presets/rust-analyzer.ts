import type { Preset } from "../config/schema.ts";

/**
 * rust-analyzer adapter
 */
export const rustAnalyzerAdapter: Preset = {
  presetId: "rust-analyzer",
  bin: "rust-analyzer",
  args: [],
  files: ["**/*.rs"],
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
