import type { LspAdapter } from "../types.ts";
import { execSync } from "child_process";
import { getNodeModulesBin } from "../core/io/nodeModulesUtils.ts";

/**
 * MoonBit language server adapter
 */
export const moonbitLanguageServerAdapter: LspAdapter = {
  id: "moonbit-language-server",
  name: "MoonBit Language Server",
  baseLanguage: "moonbit",
  description: "moonbit lsp",
  extensions: [".mbt", ".mbti"],
  lspCommand: "moonbit-lsp",
  lspArgs: [],
  doctor: async () => {
    try {
      const binPath = getNodeModulesBin("moonbit-lsp");
      if (binPath) {
        return { ok: true };
      }
      // Fall back to checking in PATH
      execSync("which moonbit-lsp", { stdio: "ignore" });
      return { ok: true };
    } catch {
      return {
        ok: false,
        message:
          "moonbit-lsp not found. Install MoonBit from https://www.moonbitlang.com/",
      };
    }
  },
};
