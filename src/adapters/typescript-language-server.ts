import type { LspAdapter } from "../types.ts";
import { execSync } from "child_process";

/**
 * TypeScript Language Server adapter (default)
 */
export const typescriptAdapter: LspAdapter = {
  id: "typescript",
  name: "TypeScript Language Server",
  baseLanguage: "typescript",
  description: "Community TypeScript Language Server",
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
  lspArgs: ["typescript-language-server", "--stdio"],
  initializationOptions: {
    preferences: {
      includeCompletionsForModuleExports: true,
      includeCompletionsWithInsertText: true,
    },
  },
  doctor: async () => {
    try {
      execSync("which npx", { stdio: "ignore" });
      return { ok: true };
    } catch {
      return { ok: false, message: "npx not found in PATH" };
    }
  },
};
