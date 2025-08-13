/**
 * Unified debug logging utility for the lsmcp project
 *
 * This provides a centralized way to handle debug output across the entire codebase.
 * Debug messages are only shown when LSMCP_DEBUG=1 environment variable is set.
 *
 * IMPORTANT: For MCP servers, all debug output must go to stderr (console.error)
 * since stdout is used for MCP protocol communication.
 */

/**
 * Debug logging function that respects LSMCP_DEBUG environment variable
 *
 * @param args Arguments to log (same as console.error)
 *
 * @example
 * debugLog("Processing file:", filename);
 * debugLog("[SymbolIndex] Indexed files:", count);
 */
export function debugLog(...args: unknown[]): void {
  if (process.env.LSMCP_DEBUG === "1") {
    console.error(...args);
  }
}

/**
 * Debug logging function with prefix for specific components
 *
 * @param prefix Component prefix (e.g., "SymbolIndex", "LSP", "MCP")
 * @param args Arguments to log
 *
 * @example
 * debugLogWithPrefix("SymbolIndex", "Indexed files:", count);
 * debugLogWithPrefix("LSP", "Server started for", language);
 */
export function debugLogWithPrefix(prefix: string, ...args: unknown[]): void {
  if (process.env.LSMCP_DEBUG === "1") {
    console.error(`[${prefix}]`, ...args);
  }
}

/**
 * Error logging function that always shows errors (ignores LSMCP_DEBUG)
 * Use this for critical errors that should always be visible
 *
 * @param args Arguments to log
 *
 * @example
 * errorLog("Failed to start LSP server:", error.message);
 * errorLog("Critical configuration error:", errorDetails);
 */
export function errorLog(...args: unknown[]): void {
  console.error(...args);
}

/**
 * Conditional debug logging - only logs if condition is true and LSMCP_DEBUG=1
 *
 * @param condition Boolean condition
 * @param args Arguments to log if condition is true
 *
 * @example
 * conditionalDebug(files.length > 100, "Large file set detected:", files.length);
 */
export function conditionalDebug(condition: boolean, ...args: unknown[]): void {
  if (condition && process.env.LSMCP_DEBUG === "1") {
    console.error(...args);
  }
}

// Re-export for backward compatibility with existing debug utilities
export { debugLog as debug };
