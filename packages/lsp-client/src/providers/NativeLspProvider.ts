/**
 * Native LSP Client Provider
 * Provides an LspClientAdapter implementation using the native LSP client
 */

import { spawn } from "child_process";
import type { ChildProcess } from "child_process";
import { createAndInitializeLSPClient } from "../index.ts";
import type {
  LspClientAdapter,
  LspClientProvider,
  LspClientConfig,
} from "@lsmcp/types";

/**
 * Native LSP Client Provider
 * Creates LSPClient instances that implement LspClientAdapter
 */
export class NativeLspProvider implements LspClientProvider {
  async createAdapter(config: LspClientConfig): Promise<LspClientAdapter> {
    let process: ChildProcess | undefined;

    // Spawn LSP server process if command is provided
    if (config.command) {
      process = spawn(config.command, config.args || [], {
        cwd: config.rootPath,
        env: { ...global.process?.env, ...config.env },
      });
    }

    // Create and initialize LSP client
    // LSPClient now implements LspClientAdapter interface
    const client = await createAndInitializeLSPClient(
      config.rootPath,
      process!,
      config.languageId,
      config.initializationOptions,
      config.serverCapabilities as any,
    );

    // LSPClient implements LspClientAdapter interface
    // Cast is safe as LSPClient implements all required methods
    return client as unknown as LspClientAdapter;
  }

  getInfo() {
    return {
      name: "Native LSP Client",
      type: "native" as const,
      description: "Native LSP client implementation using @lsmcp/lsp-client",
    };
  }

  async isAvailable(): Promise<boolean> {
    // Native provider is always available when the module is loaded
    return true;
  }
}

// Export singleton instance for convenience
export const nativeLspProvider = new NativeLspProvider();
