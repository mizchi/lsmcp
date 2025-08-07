/**
 * Tool registry for LSP tools
 */

import type { ToolDef } from "../utils/mcpHelpers.ts";

// Import LSP tools
import { lspGetHoverTool } from "../../lsp/tools/hover.ts";
import { lspFindReferencesTool } from "../../lsp/tools/references.ts";
import { lspGetDefinitionsTool } from "../../lsp/tools/definitions.ts";
import { lspGetDiagnosticsTool } from "../../lsp/tools/diagnostics.ts";
import { lspGetAllDiagnosticsTool } from "../../lsp/tools/allDiagnostics.ts";
import { lspRenameSymbolTool } from "../../lsp/tools/rename.ts";
import { lspDeleteSymbolTool } from "../../lsp/tools/deleteSymbol.ts";
import { lspGetDocumentSymbolsTool } from "../../lsp/tools/documentSymbols.ts";
import { lspGetCompletionTool } from "../../lsp/tools/completion.ts";
import { lspGetSignatureHelpTool } from "../../lsp/tools/signatureHelp.ts";
import { lspFormatDocumentTool } from "../../lsp/tools/formatting.ts";
import { lspGetCodeActionsTool } from "../../lsp/tools/codeActions.ts";
import { lspGetWorkspaceSymbolsTool } from "../../lsp/tools/workspaceSymbols.ts";
import { lspCheckCapabilitiesTool } from "../../lsp/tools/checkCapabilities.ts";

// Import analysis tools
import { indexTools } from "../tools/indexTools.ts";

// Import serenity tools
import { serenityTools } from "../tools/index.ts";

// Import onboarding tools
import { indexOnboardingTools } from "../onboarding/onboardingTools.ts";

// Define LSP-only tools
export const lspTools: ToolDef<any>[] = [
  lspGetHoverTool,
  lspFindReferencesTool,
  lspGetDefinitionsTool,
  lspGetDiagnosticsTool,
  lspGetAllDiagnosticsTool,
  lspRenameSymbolTool,
  lspDeleteSymbolTool,
  lspGetDocumentSymbolsTool,
  lspGetCompletionTool,
  lspGetSignatureHelpTool,
  lspFormatDocumentTool,
  lspGetCodeActionsTool,
  lspGetWorkspaceSymbolsTool,
  lspCheckCapabilitiesTool,
];

// Define high-level analysis tools (not affected by LSP capabilities)
export const highLevelTools: ToolDef<any>[] = [...indexTools];

// Define serenity tools
export const serenityToolsList: ToolDef<any>[] = Object.values(serenityTools);

// Define onboarding tools
export const onboardingToolsList: ToolDef<any>[] = indexOnboardingTools;

// Tool name mapping for unsupported filtering
const toolNameMap: Record<string, string> = {
  get_hover: lspGetHoverTool.name,
  find_references: lspFindReferencesTool.name,
  get_definitions: lspGetDefinitionsTool.name,
  get_diagnostics: lspGetDiagnosticsTool.name,
  get_all_diagnostics: lspGetAllDiagnosticsTool.name,
  rename_symbol: lspRenameSymbolTool.name,
  delete_symbol: lspDeleteSymbolTool.name,
  get_document_symbols: lspGetDocumentSymbolsTool.name,
  get_completion: lspGetCompletionTool.name,
  get_signature_help: lspGetSignatureHelpTool.name,
  format_document: lspFormatDocumentTool.name,
  get_code_actions: lspGetCodeActionsTool.name,
  get_workspace_symbols: lspGetWorkspaceSymbolsTool.name,
  check_capabilities: lspCheckCapabilitiesTool.name,
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
