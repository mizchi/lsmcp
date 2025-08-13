/**
 * Tool filtering utilities
 */

import {
  debug,
  type ServerCapabilities,
  CapabilityChecker,
  createToolCapabilityMap,
} from "@lsmcp/lsp-client";
import type { McpToolDef } from "@lsmcp/types";

// Use the centralized capability map from lsp-client
const toolCapabilityMap = createToolCapabilityMap();

/**
 * Special handling for certain capabilities that require custom logic
 */
const CAPABILITY_SPECIAL_CASES: Record<
  string,
  (checker: CapabilityChecker) => boolean
> = {
  // Diagnostics can be provided through different methods
  get_diagnostics: (checker) => {
    return (
      checker.hasCapability("diagnosticProvider") ||
      checker.hasCapability("textDocumentSync")
    );
  },
  get_all_diagnostics: (checker) => {
    return (
      checker.hasCapability("diagnosticProvider") ||
      checker.hasCapability("textDocumentSync")
    );
  },
  // Delete symbol is typically part of code actions
  delete_symbol: (checker) => {
    return checker.hasCapability("codeActionProvider");
  },
};

/**
 * Check if a tool is supported by the server capabilities
 */
export function isToolSupportedByCapabilities(
  toolName: string,
  capabilities: ServerCapabilities | undefined,
): boolean {
  const checker = new CapabilityChecker(capabilities);

  if (!capabilities) {
    // If we don't have capabilities yet, assume all tools are supported
    // This can happen during initialization
    return true;
  }

  // Check special cases first
  const specialCase = CAPABILITY_SPECIAL_CASES[toolName];
  if (specialCase) {
    return specialCase(checker);
  }

  // Check standard capability mapping
  const requiredCapabilities = toolCapabilityMap.get(toolName);
  if (!requiredCapabilities || requiredCapabilities.length === 0) {
    // If no mapping exists, assume the tool is supported
    return true;
  }

  // Check if all required capabilities are supported
  return checker.hasCapabilities(requiredCapabilities);
}

/**
 * Filter tools based on server capabilities
 * This should be called after the LSP server is initialized
 */
export function filterToolsByCapabilities(
  tools: McpToolDef<any>[],
  capabilities: ServerCapabilities | undefined,
): McpToolDef<any>[] {
  const checker = new CapabilityChecker(capabilities);

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

  // Log detailed capability support for debugging
  const support = checker.getCapabilitySupport();
  debug("Server capability support:", support);

  return filtered;
}

/**
 * Filter tools based on unsupported list from config
 */
export function filterUnsupportedTools(
  tools: McpToolDef<any>[],
  unsupported: string[] = [],
): McpToolDef<any>[] {
  if (unsupported.length === 0) return tools;

  const unsupportedSet = new Set(unsupported);
  return tools.filter((tool) => !unsupportedSet.has(tool.name));
}

/**
 * Create a capability-aware tool filter that can be used after initialization
 * This allows for dynamic tool filtering based on runtime capabilities
 */
export function createCapabilityFilter(client?: any) {
  let cachedCapabilities: ServerCapabilities | undefined;
  let checker = new CapabilityChecker();

  return {
    /**
     * Update the cached capabilities
     */
    updateCapabilities(capabilities: ServerCapabilities | undefined) {
      cachedCapabilities = capabilities;
      checker.setCapabilities(capabilities);
      debug("Updated cached server capabilities");
    },

    /**
     * Filter tools based on current capabilities
     */
    filterTools(tools: McpToolDef<any>[]): McpToolDef<any>[] {
      // Try to get fresh capabilities from the LSP client
      const currentCapabilities =
        client?.getServerCapabilities() || cachedCapabilities;

      if (currentCapabilities && currentCapabilities !== cachedCapabilities) {
        // Update checker if capabilities have changed
        checker.setCapabilities(currentCapabilities);
        cachedCapabilities = currentCapabilities;
      }

      return filterToolsByCapabilities(tools, currentCapabilities);
    },

    /**
     * Check if a specific tool is supported
     */
    isToolSupported(toolName: string): boolean {
      const currentCapabilities =
        client?.getServerCapabilities() || cachedCapabilities;
      return isToolSupportedByCapabilities(toolName, currentCapabilities);
    },

    /**
     * Get the underlying CapabilityChecker instance
     */
    getChecker(): CapabilityChecker {
      return checker;
    },
  };
}
