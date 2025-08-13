import type { Preset } from "../config/schema.ts";

/**
 * Pyright adapter - Microsoft's Python language server
 */
export const pyrightAdapter: Preset = {
  presetId: "pyright",
  bin: "uv",
  args: ["run", "pyright-langserver", "--stdio"],
  files: ["**/*.py", "**/*.pyi"],
  initializationOptions: {
    python: {
      analysis: {
        autoSearchPaths: true,
        useLibraryCodeForTypes: true,
        diagnosticMode: "workspace",
      },
    },
  },
  serverCharacteristics: {
    documentOpenDelay: 1500,
    readinessCheckTimeout: 800,
    initialDiagnosticsTimeout: 2500,
    requiresProjectInit: false,
    sendsInitialDiagnostics: true,
    operationTimeout: 12000,
  },
};
