import { getNodeModulesCommand } from "../core/io/nodeModulesUtils.ts";
import type { LanguageConfig, LspAdapter } from "../types.ts";

/**
 * Convert an LSP adapter to a language configuration, resolving node_modules binaries
 */
export function adapterToLanguageConfig(
  adapter: LspAdapter,
  projectRoot?: string,
): LanguageConfig {
  // Check if this is a node_modules binary that should be resolved
  const nodeModulesBinaries = [
    "typescript-language-server",
    "tsgo",
    "moonbit-lsp",
  ];

  let lspCommand = adapter.lspCommand;
  let lspArgs = adapter.lspArgs || [];

  // If it's a known node_modules binary, try to resolve it
  if (nodeModulesBinaries.includes(adapter.lspCommand)) {
    const resolved = getNodeModulesCommand(
      adapter.lspCommand,
      lspArgs,
      projectRoot,
    );
    lspCommand = resolved.command;
    lspArgs = resolved.args;
  }

  return {
    id: adapter.id,
    name: adapter.name,
    extensions: adapter.extensions,
    lspCommand,
    lspArgs,
    initializationOptions: adapter.initializationOptions,
  };
}

/**
 * Resolve the LSP command for an adapter, handling node_modules binaries
 */
export function resolveAdapterCommand(
  adapter: LspAdapter,
  projectRoot?: string,
): { command: string; args: string[] } {
  const nodeModulesBinaries = [
    "typescript-language-server",
    "tsgo",
    "moonbit-lsp",
  ];

  if (nodeModulesBinaries.includes(adapter.lspCommand)) {
    const resolved = getNodeModulesCommand(
      adapter.lspCommand,
      adapter.lspArgs || [],
      projectRoot,
    );
    // Log when we resolve to node_modules (only in debug mode)
    if (!resolved.command.includes("npx") && process.env.DEBUG_LSP) {
      console.error(
        `[lsmcp] Resolved ${adapter.lspCommand} to: ${resolved.command}`,
      );
    }
    return resolved;
  }

  return {
    command: adapter.lspCommand,
    args: adapter.lspArgs || [],
  };
}
