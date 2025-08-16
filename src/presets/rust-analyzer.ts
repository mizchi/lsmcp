import type { Preset } from "../config/schema.ts";

/**
 * rust-analyzer adapter
 */
export const rustAnalyzerAdapter: Preset = {
  presetId: "rust-analyzer",
  name: "rust-analyzer",
  description: "Language Server for Rust",
  binFindStrategy: {
    strategies: [
      // 1. Check global installation (most common for Rust)
      { type: "global", names: ["rust-analyzer"] },
      // 2. Check cargo install location
      { type: "path", path: "~/.cargo/bin/rust-analyzer" },
      // 3. Check system package manager installations
      { type: "path", path: "/usr/bin/rust-analyzer" },
      { type: "path", path: "/usr/local/bin/rust-analyzer" },
    ],
    defaultArgs: [],
  },
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
