/**
 * Factory function to create LSP Client providers
 */

import type { FileSystemApi, LspClientProvider } from "@internal/types";
import { NativeLspProvider } from "./NativeLspProvider.ts";

/**
 * Create an LSP Client provider
 * @param fs Optional FileSystemApi for advanced features
 * @returns LspClientProvider instance
 */
export function createLspClientProvider(
  _fs?: FileSystemApi,
): LspClientProvider {
  // For now, fs is optional and not used
  // Future implementations may use it for features like:
  // - Reading workspace configuration files
  // - Managing temporary files for LSP operations
  // - Virtual file system support

  return new NativeLspProvider();
}

/**
 * Create a default LSP Client provider
 * Convenience function for common usage
 */
export function createDefaultLspClientProvider(): LspClientProvider {
  return createLspClientProvider();
}
