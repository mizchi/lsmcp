import type { Preset } from "../config/schema.ts";

/**
 * Pyright adapter - Microsoft's Python language server
 */
export const pyrightAdapter: Preset = {
  presetId: "pyright",
  name: "Pyright",
  description: "Microsoft's Python language server",
  binFindStrategy: {
    strategies: [
      // 1. Try UV run first (preferred for Python projects)
      { type: "uv", tool: "pyright", command: "pyright-langserver" },
      // 2. Check global installation
      { type: "global", names: ["pyright-langserver"] },
      // 3. Try uvx as fallback
      { type: "uvx", package: "pyright" },
      // 4. Check Python virtual environments
      { type: "venv", names: ["pyright-langserver"] },
      // 5. Check node_modules (if installed via npm)
      { type: "node_modules", names: ["pyright-langserver"] },
      // 6. Fall back to npx
      { type: "npx", package: "pyright" },
    ],
    defaultArgs: ["--stdio"],
  },
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
