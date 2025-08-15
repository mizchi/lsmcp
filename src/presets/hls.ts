import type { Preset } from "../config/schema.ts";

/**
 * Haskell Language Server (HLS) adapter
 */
export const hlsAdapter: Preset = {
  presetId: "hls",
  name: "Haskell Language Server",
  description: "Official language server for Haskell",
  baseLanguage: "haskell",
  binFindStrategy: {
    strategies: [
      // 1. Check GHCup installation (primary)
      { type: "path", path: "~/.ghcup/bin/haskell-language-server-wrapper" },
      // 2. Check global installation
      {
        type: "global",
        names: ["haskell-language-server-wrapper", "haskell-language-server"],
      },
      // 3. Check in project's .stack-work
      {
        type: "path",
        path: ".stack-work/install/*/bin/haskell-language-server-wrapper",
      },
      // 4. Check Cabal installation
      {
        type: "path",
        path: "dist-newstyle/build/*/haskell-language-server-wrapper",
      },
    ],
    defaultArgs: ["--lsp"],
  },
  files: ["**/*.hs", "**/*.lhs"],
  initializationOptions: {
    haskell: {
      formattingProvider: "ormolu",
      checkProject: true,
    },
  },
  serverCharacteristics: {
    documentOpenDelay: 3000,
    readinessCheckTimeout: 5000,
    initialDiagnosticsTimeout: 10000,
    requiresProjectInit: true,
    sendsInitialDiagnostics: true,
    operationTimeout: 20000,
  },
};
