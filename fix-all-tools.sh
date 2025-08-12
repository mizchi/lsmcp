#!/bin/bash

# Fix all tool exports to use factory functions

# documentSymbols.ts
cat > /tmp/documentSymbols-fix.txt << 'EOF'
/**
 * Create document symbols tool with injected LSP client
 */
export function createDocumentSymbolsTool(client: LSPClient): ToolDef<typeof schema> {
  return {
    name: "get_document_symbols",
    description: "Get all symbols (functions, classes, variables, etc.) in a document using LSP",
    schema,
    execute: async (args) => {
      return handleGetDocumentSymbols(args, client);
    },
  };
}

// Legacy export - will be removed
export const lspGetDocumentSymbolsTool = null as any;
EOF

# signatureHelp.ts
cat > /tmp/signatureHelp-fix.txt << 'EOF'
/**
 * Create signature help tool with injected LSP client
 */
export function createSignatureHelpTool(client: LSPClient): ToolDef<typeof schema> {
  return {
    name: "get_signature_help",
    description: "Get signature help (parameter hints) for function calls at a specific position using LSP",
    schema,
    execute: async (args) => {
      return handleGetSignatureHelp(args, client);
    },
  };
}

// Legacy export - will be removed
export const lspGetSignatureHelpTool = null as any;
EOF

# formatting.ts
cat > /tmp/formatting-fix.txt << 'EOF'
/**
 * Create format document tool with injected LSP client
 */
export function createFormatDocumentTool(client: LSPClient): ToolDef<typeof schema> {
  return {
    name: "format_document",
    description: "Format an entire document using the language server's formatting provider",
    schema,
    execute: async (args) => {
      return handleFormatDocument(args, client);
    },
  };
}

// Legacy export - will be removed
export const lspFormatDocumentTool = null as any;
EOF

# workspaceSymbols.ts
cat > /tmp/workspaceSymbols-fix.txt << 'EOF'
/**
 * Create workspace symbols tool with injected LSP client
 */
export function createWorkspaceSymbolsTool(client: LSPClient): ToolDef<typeof schema> {
  return {
    name: "get_workspace_symbols",
    description: "Search for symbols (classes, functions, variables, etc.) across the entire workspace using LSP. Note: This feature may not be supported by all language servers. TypeScript/JavaScript support is temporarily disabled.",
    schema,
    execute: async (args) => {
      return handleGetWorkspaceSymbols(args, client);
    },
  };
}

// Legacy export - will be removed
export const lspGetWorkspaceSymbolsTool = null as any;
EOF

# codeActions.ts
cat > /tmp/codeActions-fix.txt << 'EOF'
/**
 * Create code actions tool with injected LSP client
 */
export function createCodeActionsTool(client: LSPClient): ToolDef<typeof schema> {
  return {
    name: "get_code_actions",
    description: "Get available code actions (quick fixes, refactorings) for a range in a file using LSP",
    schema,
    execute: async (args) => {
      return handleGetCodeActions(args, client);
    },
  };
}

// Legacy export - will be removed
export const lspGetCodeActionsTool = null as any;
EOF

# checkCapabilities.ts
cat > /tmp/checkCapabilities-fix.txt << 'EOF'
/**
 * Create check capabilities tool with injected LSP client
 */
export function createCheckCapabilitiesTool(client: LSPClient): ToolDef<typeof schema> {
  return {
    name: "check_capabilities",
    description: "Check the capabilities of the current language server. Shows which features are supported.",
    schema,
    execute: async () => {
      return handleCheckCapabilities(client);
    },
  };
}

// Legacy export - will be removed
export const lspCheckCapabilitiesTool = null as any;
EOF

echo "Templates created"