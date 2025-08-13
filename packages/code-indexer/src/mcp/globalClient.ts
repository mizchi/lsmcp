/**
 * Global LSP client management for MCP tools
 * This is a temporary solution until we have proper dependency injection
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