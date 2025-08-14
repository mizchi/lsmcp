import type { Preset } from "../config/schema.ts";

/**
 * Deno language server adapter
 */
export const denoAdapter: Preset = {
  presetId: "deno",
  bin: "deno",
  args: ["lsp"],
  files: ["**/*.ts", "**/*.tsx", "**/*.d.ts"],
  initializationOptions: {
    enable: true,
    lint: true,
    unstable: true,
  },
  serverCharacteristics: {
    documentOpenDelay: 1500,
    readinessCheckTimeout: 1000,
    initialDiagnosticsTimeout: 2500,
    requiresProjectInit: false,
    sendsInitialDiagnostics: true,
    operationTimeout: 10000,
  },
};
