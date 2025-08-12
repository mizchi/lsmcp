import type { Preset } from "../types/lsp.ts";
import { extractTypeTool } from "../languageSpecific/ts/tools/tsExtractType.ts";
import { generateAccessorsTool } from "../languageSpecific/ts/tools/tsGenerateAccessors.ts";
import { callHierarchyTool } from "../languageSpecific/ts/tools/tsCallHierarchy.ts";

/**
 * TypeScript Language Server adapter (default)
 */
export const typescriptAdapter: Preset = {
  presetId: "typescript",
  bin: "typescript-language-server",
  args: ["--stdio"],
  files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  initializationOptions: {
    preferences: {
      includeCompletionsForModuleExports: true,
      includeCompletionsWithInsertText: true,
    },
  },
  customTools: [
    extractTypeTool as unknown as import("../utils/mcpHelpers.ts").ToolDef<
      import("zod").ZodType
    >,
    generateAccessorsTool as unknown as import("../utils/mcpHelpers.ts").ToolDef<
      import("zod").ZodType
    >,
    callHierarchyTool as unknown as import("../utils/mcpHelpers.ts").ToolDef<
      import("zod").ZodType
    >,
  ],
  serverCharacteristics: {
    documentOpenDelay: 2000,
    readinessCheckTimeout: 1000,
    initialDiagnosticsTimeout: 3000,
    requiresProjectInit: true,
    sendsInitialDiagnostics: true,
    operationTimeout: 15000,
  },
};
