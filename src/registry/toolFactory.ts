/**
 * Factory for creating LSP tools with injected client
 */

import type { LSPClient, ToolDef } from "@lsmcp/lsp-client";

// Import individual tool creators
import { createHoverTool } from "../tools/lsp/hover.ts";
import { createReferencesTool } from "../tools/lsp/references.ts";
import { createDefinitionsTool } from "../tools/lsp/definitions.ts";
import { createDiagnosticsTool } from "../tools/lsp/diagnostics.ts";
import { createRenameSymbolTool } from "../tools/lsp/rename.ts";
import { createDocumentSymbolsTool } from "../tools/lsp/documentSymbols.ts";
import { createCompletionTool } from "../tools/lsp/completion.ts";
import { createSignatureHelpTool } from "../tools/lsp/signatureHelp.ts";
import { createFormatDocumentTool } from "../tools/lsp/formatting.ts";
import { createWorkspaceSymbolsTool } from "../tools/lsp/workspaceSymbols.ts";
import { createCodeActionsTool } from "../tools/lsp/codeActions.ts";
import { createAllDiagnosticsTool } from "../tools/lsp/allDiagnostics.ts";
import { createCheckCapabilitiesTool } from "../tools/lsp/checkCapabilities.ts";
import { createDeleteSymbolTool } from "../tools/lsp/deleteSymbol.ts";

/**
 * Create all LSP tools with an injected client
 */
export function createLSPToolsWithClient(client: LSPClient): ToolDef<any>[] {
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
