import type { Preset } from "../config/schema.ts";

/**
 * TypeScript Language Server adapter (default)
 */
export const typescriptAdapter: Preset = {
  presetId: "typescript",
  binFindStrategy: {
    strategies: [
      // 1. Check node_modules first
      { type: "node_modules", names: ["typescript-language-server"] },
      // 2. Check global installation
      { type: "global", names: ["typescript-language-server"] },
      // 3. Fall back to npx
      { type: "npx", package: "typescript-language-server" },
    ],
    defaultArgs: ["--stdio"],
  },
  files: [
    "**/*.ts",
    "**/*.tsx",
    "**/*.d.ts",
    "**/*.js",
    "**/*.jsx",
    "**/*.mjs",
    "**/*.mts",
    "**/*.cjs",
  ],
  initializationOptions: {
    preferences: {
      includeCompletionsForModuleExports: true,
      includeCompletionsWithInsertText: true,
    },
  },
  serverCharacteristics: {
    documentOpenDelay: 2000,
    readinessCheckTimeout: 1000,
    initialDiagnosticsTimeout: 3000,
    requiresProjectInit: true,
    sendsInitialDiagnostics: true,
    operationTimeout: 15000,
  },

  // Language-specific features
  languageFeatures: {
    typescript: {
      enabled: true,
      indexNodeModules: true,
      maxFiles: 5000,
    },
  },

  // Unsupported features
  unsupported: [],
};
