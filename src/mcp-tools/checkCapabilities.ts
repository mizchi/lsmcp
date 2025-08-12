import { z } from "zod";
import type { ToolDef } from "@lsmcp/lsp-client";
import { getLSPClient } from "@lsmcp/lsp-client";
// These imports should be provided by the consumer
// import { getUnsupportedToolsByCapabilities } from "../../../../src/mcp/registry/capabilityFilter.ts";
// import { lspTools } from "../../../../src/mcp/registry/toolRegistry.ts";

const schemaShape = {};

const schema = z.object(schemaShape);

async function handleCheckCapabilities(): Promise<string> {
  const client = getLSPClient();
  if (!client) {
    throw new Error("LSP client not initialized");
  }

  const capabilities = client.getServerCapabilities();
  if (!capabilities) {
    return "No server capabilities available. The language server may not be fully initialized.";
  }

  let result = "# Language Server Capabilities\n\n";

  // Basic information
  result += `**Language ID**: ${client.languageId}\n\n`;

  // Core capabilities
  result += "## Core Capabilities\n\n";
  const coreCapabilities = [
    { key: "hoverProvider", name: "Hover" },
    { key: "definitionProvider", name: "Go to Definition" },
    { key: "referencesProvider", name: "Find References" },
    { key: "documentSymbolProvider", name: "Document Symbols" },
    { key: "workspaceSymbolProvider", name: "Workspace Symbols" },
    { key: "completionProvider", name: "Code Completion" },
    { key: "signatureHelpProvider", name: "Signature Help" },
    { key: "documentFormattingProvider", name: "Document Formatting" },
    { key: "documentRangeFormattingProvider", name: "Range Formatting" },
    { key: "renameProvider", name: "Rename" },
    { key: "codeActionProvider", name: "Code Actions" },
  ];

  for (const { key, name } of coreCapabilities) {
    const value = capabilities[key];
    const status = value ? "✅" : "❌";
    result += `- ${status} **${name}**: ${formatCapabilityValue(value)}\n`;
  }

  // Text document sync
  result += "\n## Text Document Synchronization\n\n";
  if (capabilities.textDocumentSync) {
    if (typeof capabilities.textDocumentSync === "number") {
      result += `- Sync Kind: ${getSyncKindName(capabilities.textDocumentSync)}\n`;
    } else if (typeof capabilities.textDocumentSync === "object") {
      const sync = capabilities.textDocumentSync;
      result += `- Open/Close: ${sync.openClose ? "✅" : "❌"}\n`;
      result += `- Change: ${sync.change !== undefined ? getSyncKindName(sync.change) : "Not specified"}\n`;
      result += `- Save: ${formatSaveCapability(sync.save)}\n`;
    }
  } else {
    result += "Text document synchronization not configured\n";
  }

  // Diagnostic provider
  if (capabilities.diagnosticProvider) {
    result += "\n## Diagnostic Provider\n\n";
    const diag = capabilities.diagnosticProvider;
    result += `- Identifier: ${diag.identifier || "Not specified"}\n`;
    result += `- Inter-file Dependencies: ${diag.interFileDependencies ? "✅" : "❌"}\n`;
    result += `- Workspace Diagnostics: ${diag.workspaceDiagnostics ? "✅" : "❌"}\n`;
  }

  // Workspace capabilities
  if (capabilities.workspace && typeof capabilities.workspace === "object") {
    result += "\n## Workspace Capabilities\n\n";
    const workspace = capabilities.workspace as any;
    if (workspace.workspaceFolders) {
      result += `- Workspace Folders: ✅\n`;
    }
    if (workspace.fileOperations) {
      result += `- File Operations:\n`;
      if (workspace.fileOperations.willRename) {
        result += `  - Will Rename: ✅\n`;
      }
      if (workspace.fileOperations.didCreate) {
        result += `  - Did Create: ✅\n`;
      }
      if (workspace.fileOperations.didRename) {
        result += `  - Did Rename: ✅\n`;
      }
      if (workspace.fileOperations.didDelete) {
        result += `  - Did Delete: ✅\n`;
      }
    }
  }

  // Tool support check is disabled in the standalone package
  // To check unsupported tools, the consumer should provide this functionality
  // const unsupportedTools = getUnsupportedToolsByCapabilities(lspTools, capabilities);

  // Raw capabilities (for debugging)
  result += "\n## Raw Capabilities (Debug)\n\n";
  result += "```json\n";
  result += JSON.stringify(capabilities, null, 2);
  result += "\n```\n";

  return result.trim();
}

function formatCapabilityValue(value: any): string {
  if (value === true) return "Supported";
  if (value === false || value === undefined || value === null)
    return "Not supported";
  if (typeof value === "object") return "Supported (with options)";
  return String(value);
}

function getSyncKindName(kind: number): string {
  switch (kind) {
    case 0:
      return "None";
    case 1:
      return "Full";
    case 2:
      return "Incremental";
    default:
      return `Unknown (${kind})`;
  }
}

function formatSaveCapability(save: any): string {
  if (save === true) return "✅ Supported";
  if (save === false || save === undefined) return "❌ Not supported";
  if (typeof save === "object" && save.includeText) {
    return "✅ Supported (with text)";
  }
  return "✅ Supported";
}

export const lspCheckCapabilitiesTool: ToolDef<typeof schema> = {
  name: "check_capabilities",
  description:
    "Check the capabilities of the current language server. Shows which features are supported.",
  schema,
  execute: async () => {
    return handleCheckCapabilities();
  },
};
