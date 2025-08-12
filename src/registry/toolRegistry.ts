/**
 * Tool registry for LSP tools
 */

import type { LSPClient } from "@lsmcp/lsp-client";
import { createLSPToolsWithClient } from "./toolFactory.ts";

// Import analysis tools
import { indexTools } from "../tools/finder/indexTools.ts";

// Import serenity tools
import { serenityTools } from "../tools/index.ts";

// Import onboarding tools
import { indexOnboardingTools } from "../features/memory/onboarding/onboardingTools.ts";
import { ToolDef } from "@lsmcp/lsp-client";

/**
 * Create LSP tools with injected client
 */
export function createLSPTools(client: LSPClient): ToolDef<any>[] {
  return createLSPToolsWithClient(client);
}

// Legacy export - should not be used
export const lspTools: ToolDef<any>[] = [];

// Define high-level analysis tools (not affected by LSP capabilities)
export const highLevelTools: ToolDef<any>[] = [...indexTools];

// Define serenity tools
export const serenityToolsList: ToolDef<any>[] = Object.values(serenityTools);

// Define onboarding tools
export const onboardingToolsList: ToolDef<any>[] = indexOnboardingTools;

// Tool name mapping for unsupported filtering
const toolNameMap: Record<string, string> = {
  get_hover: "get_hover",
  find_references: "find_references",
  get_definitions: "get_definitions",
  get_diagnostics: "get_diagnostics",
  get_all_diagnostics: "get_all_diagnostics",
  rename_symbol: "rename_symbol",
  delete_symbol: "delete_symbol",
  get_document_symbols: "get_document_symbols",
  get_completion: "get_completion",
  get_signature_help: "get_signature_help",
  format_document: "format_document",
  get_code_actions: "get_code_actions",
  get_workspace_symbols: "get_workspace_symbols",
  check_capabilities: "check_capabilities",
};

/**
 * Filter tools based on unsupported list
 */
export function filterUnsupportedTools(
  tools: ToolDef<any>[],
  unsupported: string[] = [],
): ToolDef<any>[] {
  if (unsupported.length === 0) return tools;

  const unsupportedToolNames = new Set(
    unsupported.map((name) => toolNameMap[name]).filter(Boolean),
  );

  return tools.filter((tool) => !unsupportedToolNames.has(tool.name));
}
