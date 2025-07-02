import type { LspAdapter } from "../types.ts";

/**
 * MoonBit language server adapter
 */
export const moonbitLanguageServerAdapter: LspAdapter = {
  id: "moonbit-language-server",
  name: "MoonBit Language Server",
  baseLanguage: "moonbit",
  description: "moonbit lsp",
  extensions: [".mbt", ".mbti"],
  lspCommand: "npx",
  lspArgs: ["moonbit-lsp"],
};
