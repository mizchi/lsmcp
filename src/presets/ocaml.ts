import type { Preset } from "../config/schema.ts";

/**
 * OCaml Language Server (ocaml-lsp) adapter
 */
export const ocamlAdapter: Preset = {
  presetId: "ocaml",
  name: "OCaml Language Server",
  description: "Official language server for OCaml",
  baseLanguage: "ocaml",
  binFindStrategy: {
    strategies: [
      // 1. Check opam installation
      { type: "global", names: ["ocamllsp"] },
      // 2. Check in _opam directory (local switch)
      { type: "path", path: "_opam/bin/ocamllsp" },
      // 3. Check in ~/.opam/<switch>/bin
      { type: "path", path: "~/.opam/default/bin/ocamllsp" },
      // 4. Check esy installation
      { type: "path", path: "_esy/default/build/install/default/bin/ocamllsp" },
    ],
    defaultArgs: ["--stdio"],
  },
  files: ["**/*.ml", "**/*.mli", "**/*.mll", "**/*.mly"],
  initializationOptions: {
    codelens: {
      enable: true,
    },
    extendedHover: {
      enable: true,
    },
  },
  serverCharacteristics: {
    documentOpenDelay: 1500,
    readinessCheckTimeout: 800,
    initialDiagnosticsTimeout: 3000,
    requiresProjectInit: true,
    sendsInitialDiagnostics: true,
    operationTimeout: 12000,
  },
};
