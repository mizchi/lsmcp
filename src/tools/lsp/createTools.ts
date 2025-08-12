/**
 * Factory function to create LSP tools with a specific client
 */

import type { LSPClient } from "@lsmcp/lsp-client";
import type { ToolDef } from "@lsmcp/lsp-client";

// Import all tool creation functions
import { createHoverTool } from "./hover.ts";
import { createReferencesTool } from "./references.ts";
import { createDefinitionsTool } from "./definitions.ts";
import { createDiagnosticsTool } from "./diagnostics.ts";
import { createRenameSymbolTool } from "./rename.ts";
import { createDocumentSymbolsTool } from "./documentSymbols.ts";
import { createCompletionTool } from "./completion.ts";
import { createSignatureHelpTool } from "./signatureHelp.ts";
import { createFormatDocumentTool } from "./formatting.ts";
import { createWorkspaceSymbolsTool } from "./workspaceSymbols.ts";
import { createCodeActionsTool } from "./codeActions.ts";
import { createAllDiagnosticsTool } from "./allDiagnostics.ts";
import { createCheckCapabilitiesTool } from "./checkCapabilities.ts";
import { createDeleteSymbolTool } from "./deleteSymbol.ts";

/**
 * Create all LSP tools with a specific client
 */
export function createLSPTools(client: LSPClient): ToolDef<any>[] {
  return [
    createHoverTool(client),
    createReferencesTool(client),
    createDefinitionsTool(client),
    createDiagnosticsTool(client),
    createRenameSymbolTool(client),
    createDocumentSymbolsTool(client),
    createCompletionTool(client),
    createSignatureHelpTool(client),
    createFormatDocumentTool(client),
    createWorkspaceSymbolsTool(client),
    createCodeActionsTool(client),
    createAllDiagnosticsTool(client),
    createCheckCapabilitiesTool(client),
    createDeleteSymbolTool(client),
  ];
}

/**
 * Get LSP tool names for filtering
 */
export const lspToolNames = [
  "get_hover",
  "find_references",
  "get_definitions",
  "get_diagnostics",
  "rename_symbol",
  "get_document_symbols",
  "get_completion",
  "get_signature_help",
  "format_document",
  "get_workspace_symbols",
  "get_code_actions",
  "get_all_diagnostics",
  "check_capabilities",
  "delete_symbol",
];
