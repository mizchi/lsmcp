import type { Preset } from "../config/schema.ts";

/**
 * Ruff adapter - Fast Python linter and formatter with LSP support
 */
export const ruffAdapter: Preset = {
  presetId: "ruff",
  name: "Ruff LSP",
  description: "Fast Python linter and formatter with LSP",
  binFindStrategy: {
    strategies: [
      // 1. Try UV run first (preferred for Python projects)
      { type: "uv", tool: "ruff" },
      // 2. Check global installation
      { type: "global", names: ["ruff", "ruff-lsp"] },
      // 3. Try uvx as fallback
      { type: "uvx", package: "ruff" },
      // 4. Check Python virtual environments
      { type: "venv", names: ["ruff", "ruff-lsp"] },
    ],
    defaultArgs: ["server"],
  },
  files: ["**/*.py", "**/*.pyi"],
  initializationOptions: {
    settings: {
      // Ruff configuration
      lineLength: 88,
      lint: {
        enable: true,
      },
      format: {
        enable: true,
      },
    },
  },
  serverCharacteristics: {
    documentOpenDelay: 300,
    readinessCheckTimeout: 500,
    initialDiagnosticsTimeout: 1000,
    requiresProjectInit: false,
    sendsInitialDiagnostics: true,
    operationTimeout: 5000,
  },
};
