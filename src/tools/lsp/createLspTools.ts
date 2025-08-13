/**
 * Factory for creating LSP tools with injected client
 */

import type { LSPClient } from "@lsmcp/lsp-client";
import type { McpToolDef } from "@lsmcp/types";

// Import individual tool creators
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
 * Create all LSP tools with an injected client
 */
export function createLSPTools(client: LSPClient): McpToolDef<any>[] {
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
