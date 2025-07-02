import type { LspAdapter } from "../types.ts";
import { execSync } from "child_process";

/**
 * tsgo adapter - Fast TypeScript language server
 */
export const tsgoAdapter: LspAdapter = {
  id: "tsgo",
  name: "tsgo",
  baseLanguage: "typescript",
  description: "Fast TypeScript language server by tsgo",
  extensions: [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".mts",
    ".cts",
    ".d.ts",
    ".d.mts",
    ".d.cts",
  ],

  lspCommand: "npx",
  lspArgs: ["tsgo", "--lsp", "--stdio"],
  doctor: async () => {
    try {
      execSync("which npx", { stdio: "ignore" });
      return { ok: true };
    } catch {
      return { ok: false, message: "npx not found in PATH" };
    }
  },
};
