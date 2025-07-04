import type { LspAdapter } from "../types.ts";
import { execSync } from "child_process";
import { getNodeModulesBin } from "../core/io/nodeModulesUtils.ts";
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
  bin: "typescript-language-server",
  args: ["--stdio"],
  initializationOptions: {
    preferences: {
      includeCompletionsForModuleExports: true,
      includeCompletionsWithInsertText: true,
    },
  },
  customTools: [
    extractTypeTool as unknown as import("../mcp/utils/mcpHelpers.ts").ToolDef<
      import("zod").ZodType
    >,
    generateAccessorsTool as unknown as import("../mcp/utils/mcpHelpers.ts").ToolDef<
      import("zod").ZodType
    >,
    callHierarchyTool as unknown as import("../mcp/utils/mcpHelpers.ts").ToolDef<
      import("zod").ZodType
    >,
  ],
  doctor: async () => {
    try {
      // Check if typescript-language-server is available in node_modules
      const binPath = getNodeModulesBin("typescript-language-server");
      if (binPath) {
        return { ok: true };
      }

      // Check if globally installed
      execSync("which typescript-language-server", { stdio: "ignore" });
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
