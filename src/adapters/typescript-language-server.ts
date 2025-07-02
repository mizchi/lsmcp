import type { LspAdapter } from "../types.ts";
import { execSync } from "child_process";
import { getNodeModulesBin } from "../common/nodeModulesUtils.ts";
import { extractTypeTool } from "../ts/tools/tsExtractType.ts";
import { generateAccessorsTool } from "../ts/tools/tsGenerateAccessors.ts";
import { callHierarchyTool } from "../ts/tools/tsCallHierarchy.ts";

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
  lspCommand: "typescript-language-server",
  lspArgs: ["--stdio"],
  initializationOptions: {
    preferences: {
      includeCompletionsForModuleExports: true,
      includeCompletionsWithInsertText: true,
    },
  },
  customTools: [
    extractTypeTool,
    generateAccessorsTool,
    callHierarchyTool,
  ],
  doctor: async () => {
    try {
      const binPath = getNodeModulesBin("typescript-language-server");
      if (binPath) {
        return { ok: true };
      }
      // Fall back to checking npx
      execSync("which npx", { stdio: "ignore" });
      execSync("npx -y typescript-language-server --version", {
        stdio: "ignore",
      });
      return { ok: true };
    } catch {
      return {
        ok: false,
        message:
          "typescript-language-server not found. Install with: npm install -g typescript-language-server",
      };
    }
  },
};
