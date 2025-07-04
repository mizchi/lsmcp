/**
 * Tool registry for LSP tools
 */

import type { ToolDef } from "../utils/mcpHelpers.ts";

// Import LSP tools
import { lspGetHoverTool } from "../../lsp/tools/lspGetHover.ts";
import { lspFindReferencesTool } from "../../lsp/tools/lspFindReferences.ts";
import { lspGetDefinitionsTool } from "../../lsp/tools/lspGetDefinitions.ts";
import { lspGetDiagnosticsTool } from "../../lsp/tools/lspGetDiagnostics.ts";
import { lspGetAllDiagnosticsTool } from "../../lsp/tools/lspGetAllDiagnostics.ts";
import { lspRenameSymbolTool } from "../../lsp/tools/lspRenameSymbol.ts";
import { lspDeleteSymbolTool } from "../../lsp/tools/lspDeleteSymbol.ts";
import { lspGetDocumentSymbolsTool } from "../../lsp/tools/lspGetDocumentSymbols.ts";
import { lspGetCompletionTool } from "../../lsp/tools/lspGetCompletion.ts";
import { lspGetSignatureHelpTool } from "../../lsp/tools/lspGetSignatureHelp.ts";
import { lspFormatDocumentTool } from "../../lsp/tools/lspFormatDocument.ts";
import { lspGetCodeActionsTool } from "../../lsp/tools/lspGetCodeActions.ts";
import { lspGetWorkspaceSymbolsTool } from "../../lsp/tools/lspGetWorkspaceSymbols.ts";
import { lspCheckCapabilitiesTool } from "../../lsp/tools/lspCheckCapabilities.ts";

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
