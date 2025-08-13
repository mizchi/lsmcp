/**
 * Global LSP client management for tools
 * Temporary shim until proper dependency injection is wired everywhere.
 */

let globalLspClient: any = null;

/**
 * Set the global LSP client instance
 */
export function setGlobalLspClient(client: any): void {
  globalLspClient = client;
}

/**
 * Get the global LSP client instance
 */
export function getGlobalLspClient(): any {
  return globalLspClient;
}

/**
 * Check if LSP client is available
 */
export function hasGlobalLspClient(): boolean {
  return globalLspClient !== null;
}