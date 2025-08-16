/**
 * Get all available MCP tools based on configuration
 */

import type { McpToolDef } from "@internal/types";
import type { LSPClient } from "@internal/lsp-client";
import { createLSPTools } from "./lsp/createLspTools.ts";
import {
  highLevelTools,
  serenityToolsList,
  onboardingToolsList,
} from "./toolLists.ts";

/**
 * Get all available tools for the current configuration
 */
export async function getAllAvailableTools(
  _config?: any,
  client?: LSPClient,
): Promise<McpToolDef<any>[]> {
  const tools: McpToolDef<any>[] = [];

  // Add high-level analysis tools (always available)
  tools.push(...highLevelTools);

  // Create client if not provided
  const lspClient = client || ({} as any);

  // Add low-level LSP tools (subject to capability filtering)
  const lspTools = createLSPTools(lspClient);
  tools.push(...lspTools);

  // Add serenity tools
  tools.push(...serenityToolsList);

  // Add onboarding tools
  tools.push(...onboardingToolsList);

  return tools;
}
