import type { LspAdapter } from "../types.ts";
import { execSync } from "child_process";
import { getNodeModulesBin } from "../core/io/nodeModulesUtils.ts";

/**
 * MoonBit language server adapter
 *
 * Known issues:
 * - May have slower response times for some operations
 * - Hover operations may timeout on large files
 */
export const moonbitAdapter: LspAdapter = {
  id: "moonbit",
  name: "MoonBit Language Server",
  baseLanguage: "moonbit",
  description: "moonbit lsp",
  bin: "moonbit-lsp",
  args: [],
  unsupported: [
    // "get_hover", // May be slow/timeout on some files
  ],
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
