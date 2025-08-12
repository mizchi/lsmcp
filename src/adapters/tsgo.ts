import type { Preset } from "../types/lsp.ts";

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
  bin: "npx",
  args: ["tsgo", "--lsp", "--stdio"],
  files: ["**/*.ts", "**/*.tsx"],
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
};
