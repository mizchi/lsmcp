import type { LspAdapter } from "../types.ts";

/**
 * Pyright adapter - Microsoft's Python language server
 */
export const pyrightAdapter: LspAdapter = {
  id: "pyright",
  name: "Pyright",
  baseLanguage: "python",
  description: "Microsoft's Pyright Python language server",
  lspCommand: "uv",
  lspArgs: ["run", "pyright-langserver", "--stdio"],
  initializationOptions: {
    python: {
      analysis: {
        autoSearchPaths: true,
        useLibraryCodeForTypes: true,
        diagnosticMode: "workspace",
      },
    },
  },
  // TODO:
  // doctor: async () => {
  //   return {ok: true};
  // },
};
