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

  let bin = adapter.bin;
  let args = adapter.args || [];

  // If it's a known node_modules binary, try to resolve it
  if (nodeModulesBinaries.includes(adapter.bin)) {
    const resolved = getNodeModulesCommand(adapter.bin, args, projectRoot);
    bin = resolved.command;
    args = resolved.args;
  }

  return {
    id: adapter.id,
    name: adapter.name,
    bin,
    args,
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

  if (nodeModulesBinaries.includes(adapter.bin)) {
    const resolved = getNodeModulesCommand(
      adapter.bin,
      adapter.args || [],
      projectRoot,
    );
    // Log when we resolve to node_modules (only in debug mode)
    if (!resolved.command.includes("npx") && process.env.DEBUG_LSP) {
      console.error(`[lsmcp] Resolved ${adapter.bin} to: ${resolved.command}`);
    }
    return resolved;
  }

  return {
    command: adapter.bin,
    args: adapter.args || [],
  };
}
