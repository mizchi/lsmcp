import { getNodeModulesCommand } from "../utils/nodeModulesUtils.ts";
import type { LspClientConfig } from "../config/schema.ts";
import { resolveAdapterCommand as resolveWithBinFinder } from "../utils/binFinder.ts";
import { debugLogWithPrefix } from "../utils/debugLog.ts";

/**
 * Convert an LSP client config to a language configuration, resolving node_modules binaries
 */
export function adapterToLanguageConfig(
  adapter: LspClientConfig,
  projectRoot?: string,
): LspClientConfig {
  // Use the new binFinder if binFindStrategy is available
  if (adapter.binFindStrategy && !adapter.args?.length) {
    const resolved = resolveWithBinFinder(adapter, projectRoot);
    return {
      ...adapter,
      bin: resolved.command,
      args: resolved.args,
    };
  }

  // Legacy behavior for backward compatibility
  const nodeModulesBinaries = [
    "typescript-language-server",
    "tsgo",
    "moonbit-lsp",
  ];

  let bin = adapter.bin;
  let args = adapter.args || [];

  // If it's a known node_modules binary, try to resolve it
  if (adapter.bin && nodeModulesBinaries.includes(adapter.bin)) {
    const resolved = getNodeModulesCommand(adapter.bin, args, projectRoot);
    bin = resolved.command;
    args = resolved.args;
  }

  return {
    ...adapter,
    bin,
    args,
  };
}

/**
 * Resolve the LSP command for a client config, handling node_modules binaries
 */
export function resolveAdapterCommand(
  adapter: LspClientConfig,
  projectRoot?: string,
): { command: string; args: string[] } {
  // If bin is explicitly set and no binFindStrategy exists, use bin directly
  // This happens when user provides explicit bin config without a preset,
  // or when the config loader has removed binFindStrategy due to user override
  if (adapter.bin && !adapter.binFindStrategy) {
    debugLogWithPrefix(
      "lsmcp",
      `Using explicit bin configuration: ${adapter.bin}`,
    );
    return {
      command: adapter.bin,
      args: adapter.args || [],
    };
  }

  // Use the new binFinder if binFindStrategy is available
  if (adapter.binFindStrategy) {
    return resolveWithBinFinder(adapter, projectRoot);
  }

  // Legacy behavior for backward compatibility
  const nodeModulesBinaries = [
    "typescript-language-server",
    "tsgo",
    "moonbit-lsp",
  ];

  if (adapter.bin && nodeModulesBinaries.includes(adapter.bin)) {
    const resolved = getNodeModulesCommand(
      adapter.bin,
      adapter.args || [],
      projectRoot,
    );
    // Log when we resolve to node_modules (only in debug mode)
    if (!resolved.command.includes("npx") && process.env.DEBUG_LSP) {
      debugLogWithPrefix(
        "lsmcp",
        `Resolved ${adapter.bin} to: ${resolved.command}`,
      );
    }
    return resolved;
  }

  if (adapter.bin) {
    return {
      command: adapter.bin,
      args: adapter.args || [],
    };
  }

  // No binary specified
  throw new Error("No LSP server binary specified or found");
}
