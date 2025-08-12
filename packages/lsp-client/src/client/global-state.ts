import type { LSPClient } from "../protocol/types-legacy.ts";

// Global state for backward compatibility
let activeClient: LSPClient | null = null;

/**
 * Get the active LSP client
 * @deprecated Use dependency injection instead of global state
 */
export function getActiveClient(): LSPClient | null {
  return activeClient;
}

/**
 * Set the active LSP client
 * @deprecated Use dependency injection instead of global state
 */
export function setActiveClient(client: LSPClient | null): void {
  activeClient = client;
}
