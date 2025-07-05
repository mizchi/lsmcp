/**
 * Default server characteristics and per-server overrides
 */

import type { ServerCharacteristics } from "../types.ts";

/**
 * Default characteristics for unknown servers
 */
const DEFAULT_CHARACTERISTICS: Required<ServerCharacteristics> = {
  documentOpenDelay: 1000,
  readinessCheckTimeout: 500,
  initialDiagnosticsTimeout: 2000,
  requiresProjectInit: false,
  sendsInitialDiagnostics: true,
  operationTimeout: 10000,
};

/**
 * Server-specific characteristics based on observed behavior
 */
const SERVER_CHARACTERISTICS: Record<string, ServerCharacteristics> = {
  // TypeScript/TSServer needs more time for project initialization
  typescript: {
    documentOpenDelay: 2000,
    readinessCheckTimeout: 1000,
    initialDiagnosticsTimeout: 3000,
    requiresProjectInit: true,
    sendsInitialDiagnostics: true,
    operationTimeout: 15000,
  },

  // TSGo is fast but minimal
  tsgo: {
    documentOpenDelay: 500,
    readinessCheckTimeout: 200,
    initialDiagnosticsTimeout: 1000,
    requiresProjectInit: false,
    sendsInitialDiagnostics: false,
    operationTimeout: 5000,
  },

  // Gopls is reasonably fast
  gopls: {
    documentOpenDelay: 800,
    readinessCheckTimeout: 400,
    initialDiagnosticsTimeout: 1500,
    requiresProjectInit: false,
    sendsInitialDiagnostics: true,
    operationTimeout: 8000,
  },

  // Pyright needs time for type analysis
  pyright: {
    documentOpenDelay: 1500,
    readinessCheckTimeout: 800,
    initialDiagnosticsTimeout: 2500,
    requiresProjectInit: false,
    sendsInitialDiagnostics: true,
    operationTimeout: 12000,
  },

  // Rust analyzer is slower due to compilation
  "rust-analyzer": {
    documentOpenDelay: 2500,
    readinessCheckTimeout: 1500,
    initialDiagnosticsTimeout: 5000,
    requiresProjectInit: true,
    sendsInitialDiagnostics: true,
    operationTimeout: 20000,
  },

  // Deno LSP is fast
  deno: {
    documentOpenDelay: 600,
    readinessCheckTimeout: 300,
    initialDiagnosticsTimeout: 1200,
    requiresProjectInit: false,
    sendsInitialDiagnostics: true,
    operationTimeout: 8000,
  },

  // F# (fsautocomplete) needs initialization time
  fsharp: {
    documentOpenDelay: 2000,
    readinessCheckTimeout: 1000,
    initialDiagnosticsTimeout: 3000,
    requiresProjectInit: true,
    sendsInitialDiagnostics: true,
    operationTimeout: 15000,
  },

  // Moonbit is lightweight
  moonbit: {
    documentOpenDelay: 500,
    readinessCheckTimeout: 200,
    initialDiagnosticsTimeout: 1000,
    requiresProjectInit: false,
    sendsInitialDiagnostics: false,
    operationTimeout: 5000,
  },
};

/**
 * Get server characteristics for a given language/adapter ID
 */
export function getServerCharacteristics(
  languageId: string,
  overrides?: ServerCharacteristics,
): Required<ServerCharacteristics> {
  const base = SERVER_CHARACTERISTICS[languageId] || {};

  return {
    ...DEFAULT_CHARACTERISTICS,
    ...base,
    ...(overrides || {}),
  } as Required<ServerCharacteristics>;
}

/**
 * Merge server characteristics with operation-specific overrides
 */
export function mergeCharacteristics(
  base: ServerCharacteristics,
  overrides?: ServerCharacteristics,
): Required<ServerCharacteristics> {
  return {
    ...DEFAULT_CHARACTERISTICS,
    ...base,
    ...(overrides || {}),
  } as Required<ServerCharacteristics>;
}
