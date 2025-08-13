import type { Preset } from "../config/schema.ts";
import { LANGUAGE_PATTERNS } from "../config/languagePatterns.ts";

/**
 * Deno language server adapter
 */
export const denoAdapter: Preset = {
  presetId: "deno",
  bin: "deno",
  args: ["lsp"],
  files: LANGUAGE_PATTERNS.typescript,
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
