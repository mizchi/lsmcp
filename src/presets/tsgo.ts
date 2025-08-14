import type { Preset } from "../config/schema.ts";
import { LANGUAGE_PATTERNS } from "../config/languagePatterns.ts";

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
  bin: "tsgo",
  args: ["--lsp", "--stdio"],
  binFindStrategy: {
    searchPaths: ["tsgo"],
    npxPackage: "@typescript/native-preview",
  },
  files: LANGUAGE_PATTERNS.typescript,
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
