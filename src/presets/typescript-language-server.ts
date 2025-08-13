import type { Preset } from "../config/schema.ts";
import { getTsJsPatterns } from "../config/languagePatterns.ts";

/**
 * TypeScript Language Server adapter (default)
 */
export const typescriptAdapter: Preset = {
  presetId: "typescript",
  bin: "typescript-language-server",
  args: ["--stdio"],
  files: getTsJsPatterns(),
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
