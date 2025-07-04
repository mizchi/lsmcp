/**
 * Capability-based tool filtering
 */

import type { ServerCapabilities } from "../../lsp/lspTypes.ts";
import type { ToolDef } from "../utils/mcpHelpers.ts";
import { getLSPClient } from "../../lsp/lspClient.ts";
import { debug } from "../utils/mcpHelpers.ts";

/**
 * Mapping of tool names to their required LSP capabilities
 */
const TOOL_CAPABILITY_MAP: Record<string, keyof ServerCapabilities> = {
  get_hover: "hoverProvider",
  find_references: "referencesProvider",
  get_definitions: "definitionProvider",
  get_workspace_symbols: "workspaceSymbolProvider",
  get_document_symbols: "documentSymbolProvider",
  rename_symbol: "renameProvider",
  get_code_actions: "codeActionProvider",
  format_document: "documentFormattingProvider",
  get_completion: "completionProvider",
  get_signature_help: "signatureHelpProvider",
};

/**
 * Special handling for certain capabilities
 */
const CAPABILITY_SPECIAL_CASES: Record<
  string,
  (capabilities: ServerCapabilities) => boolean
> = {
  // Diagnostics can be provided through different methods
  get_diagnostics: (caps) => {
    return !!(caps.diagnosticProvider || caps.textDocumentSync);
  },
  get_all_diagnostics: (caps) => {
    return !!(caps.diagnosticProvider || caps.textDocumentSync);
  },
  // Delete symbol is typically part of code actions
  delete_symbol: (caps) => {
    return !!caps.codeActionProvider;
  },
};

/**
 * Check if a tool is supported by the server capabilities
 */
export function isToolSupportedByCapabilities(
  toolName: string,
  capabilities: ServerCapabilities | undefined,
): boolean {
  if (!capabilities) {
    // If we don't have capabilities yet, assume all tools are supported
    // This can happen during initialization
    return true;
  }

  // Check special cases first
  const specialCase = CAPABILITY_SPECIAL_CASES[toolName];
  if (specialCase) {
    return specialCase(capabilities);
  }

  // Check standard capability mapping
  const requiredCapability = TOOL_CAPABILITY_MAP[toolName];
  if (!requiredCapability) {
    // If no mapping exists, assume the tool is supported
    return true;
  }

  // Check if the capability exists and is truthy
  const capabilityValue = capabilities[requiredCapability];
  return !!capabilityValue;
}

/**
 * Filter tools based on server capabilities
 * This should be called after the LSP server is initialized
 */
export function filterToolsByCapabilities(
  tools: ToolDef<any>[],
  capabilities: ServerCapabilities | undefined,
): ToolDef<any>[] {
  if (!capabilities) {
    // If no capabilities, return all tools
    debug("No server capabilities available, returning all tools");
    return tools;
  }

  const filtered = tools.filter((tool) => {
    const isSupported = isToolSupportedByCapabilities(tool.name, capabilities);
    if (!isSupported) {
      debug(
        `Tool '${tool.name}' filtered out - not supported by server capabilities`,
      );
    }
    return isSupported;
  });

  debug(
    `Filtered tools: ${filtered.length} out of ${tools.length} tools are supported`,
  );
  return filtered;
}

/**
 * Get a list of unsupported tools based on capabilities
 * This can be used for logging or user feedback
 */
export function getUnsupportedToolsByCapabilities(
  tools: ToolDef<any>[],
  capabilities: ServerCapabilities | undefined,
): string[] {
  if (!capabilities) {
    return [];
  }

  return tools
    .filter((tool) => !isToolSupportedByCapabilities(tool.name, capabilities))
    .map((tool) => tool.name);
}

/**
 * Create a capability-aware tool filter that can be used after initialization
 * This allows for dynamic tool filtering based on runtime capabilities
 */
export function createCapabilityFilter() {
  let cachedCapabilities: ServerCapabilities | undefined;

  return {
    /**
     * Update the cached capabilities
     */
    updateCapabilities(capabilities: ServerCapabilities | undefined) {
      cachedCapabilities = capabilities;
      debug("Updated cached server capabilities");
    },

    /**
     * Filter tools based on current capabilities
     */
    filterTools(tools: ToolDef<any>[]): ToolDef<any>[] {
      // Try to get fresh capabilities from the LSP client
      const client = getLSPClient();
      const currentCapabilities =
        client?.getServerCapabilities() || cachedCapabilities;

      return filterToolsByCapabilities(tools, currentCapabilities);
    },

    /**
     * Check if a specific tool is supported
     */
    isToolSupported(toolName: string): boolean {
      const client = getLSPClient();
      const currentCapabilities =
        client?.getServerCapabilities() || cachedCapabilities;
      return isToolSupportedByCapabilities(toolName, currentCapabilities);
    },

    /**
     * Get list of unsupported tools
     */
    getUnsupportedTools(tools: ToolDef<any>[]): string[] {
      const client = getLSPClient();
      const currentCapabilities =
        client?.getServerCapabilities() || cachedCapabilities;
      return getUnsupportedToolsByCapabilities(tools, currentCapabilities);
    },
  };
}
