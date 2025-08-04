import type { LspAdapter } from "../types/lsp.ts";
import { execSync } from "child_process";

/**
 * Deno language server adapter
 */
export const denoAdapter: LspAdapter = {
  id: "deno",
  name: "Deno",
  baseLanguage: "typescript",
  description: "Deno language server",
  bin: "deno",
  args: ["lsp"],

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

  doctor: async () => {
    try {
      execSync("which deno", { stdio: "ignore" });
      return { ok: true };
    } catch {
      return { ok: false, message: "deno not found in PATH" };
    }
  },
};
