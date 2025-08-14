import type { Preset } from "../config/schema.ts";

/**
 * tsgo adapter - Fast TypeScript language server
 *
 * Known issues:
 * - May report duplicate diagnostics
 * - May report diagnostics for non-existent lines
 * - Diagnostics are deduplicated and filtered by the test helper
 */
export const tsgoAdapter: Preset = {
  presetId: "tsgo",
  binFindStrategy: {
    strategies: [
      // 1. Check node_modules first (most common for JS/TS tools)
      { type: "node_modules", names: ["tsgo"] },
      // 2. Check global installation
      { type: "global", names: ["tsgo"] },
      // 3. Fall back to npx
      { type: "npx", package: "@typescript/native-preview" },
    ],
    defaultArgs: ["--lsp", "--stdio"],
  },
  files: ["**/*.ts", "**/*.tsx", "**/*.d.ts"],
  disable: ["get_code_actions", "rename_symbol", "delete_symbol"],
  needsDiagnosticDeduplication: true,

  serverCharacteristics: {
    documentOpenDelay: 500,
    readinessCheckTimeout: 200,
    initialDiagnosticsTimeout: 1000,
    requiresProjectInit: false,
    sendsInitialDiagnostics: false,
    operationTimeout: 5000,
  },

  // Initialize with TypeScript preferences
  initializationOptions: {
    preferences: {
      includeInlayParameterNameHints: "none",
      includeInlayParameterNameHintsWhenArgumentMatchesName: false,
      includeInlayFunctionParameterTypeHints: false,
      includeInlayVariableTypeHints: false,
      includeInlayPropertyDeclarationTypeHints: false,
      includeInlayFunctionLikeReturnTypeHints: false,
      includeInlayEnumMemberValueHints: false,
    },
    // Disable some features that might cause issues
    maxTsServerMemory: 4096,
  },

  // Language-specific features
  languageFeatures: {
    typescript: {
      enabled: true,
      indexNodeModules: true,
      maxFiles: 5000,
    },
  },
};
