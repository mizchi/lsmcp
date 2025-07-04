import type { LspAdapter } from "../types.ts";
import { execSync } from "child_process";
import { getNodeModulesBin } from "../core/io/nodeModulesUtils.ts";

/**
 * tsgo adapter - Fast TypeScript language server
 *
 * Known issues:
 * - May report duplicate diagnostics
 * - May report diagnostics for non-existent lines
 * - Diagnostics are deduplicated and filtered by the test helper
 */
export const tsgoAdapter: LspAdapter = {
  id: "tsgo",
  name: "tsgo",
  baseLanguage: "typescript",
  description: "Fast TypeScript language server by tsgo",
  bin: "npx",
  args: ["tsgo", "--lsp", "--stdio"],
  unsupported: [
    "get_document_symbols",
    "get_workspace_symbols", // TSGo doesn't support workspace symbols
    "get_code_actions",
    "rename_symbol",
    "delete_symbol",
  ],
  needsDiagnosticDeduplication: true,

  // Initialize with TypeScript preferences
  initializationOptions: {
    preferences: {
      includeInlayParameterNameHints: "none",
      includeInlayParameterNameHintsWhenArgumentMatchesName: false,
      includeInlayFunctionParameterTypeHints: false,
      includeInlayVariableTypeHints: false,
      includeInlayPropertyDeclarationTypeHints: false,
      includeInlayFunctionLikeReturnTypeHints: false,
      includeInlayEnumMemberValueHints: false,
    },
    // Disable some features that might cause issues
    maxTsServerMemory: 4096,
  },

  doctor: async () => {
    try {
      const binPath = getNodeModulesBin("tsgo");
      if (binPath) {
        return { ok: true };
      }
      // Fall back to checking npx
      execSync("which npx", { stdio: "ignore" });
      execSync("npx -y tsgo --version", { stdio: "ignore" });
      return { ok: true };
    } catch {
      return {
        ok: false,
        message: "tsgo not found. Install with: npm install -g tsgo",
      };
    }
  },
};
