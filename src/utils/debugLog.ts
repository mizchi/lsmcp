/**
 * Unified debug logging utility for the lsmcp project
 *
 * This file now serves as a compatibility layer that delegates to the MCP logger.
 * Use MCP_DEBUG=1 or LSMCP_DEBUG=1 to enable debug logging for MCP server.
 * Use LSP_DEBUG=1 to enable debug logging for LSP client (handled separately).
 *
 * IMPORTANT: For MCP servers, all debug output must go to stderr (console.error)
 * since stdout is used for MCP protocol communication.
 */

import {
  mcpDebug,
  mcpDebugWithPrefix,
  mcpError,
  mcpConditionalDebug,
} from "./mcp-logger.ts";

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
  mcpDebug(...args);
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
  mcpDebugWithPrefix(prefix, ...args);
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
  mcpError(...args);
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
  mcpConditionalDebug(condition, ...args);
}

// Re-export for backward compatibility with existing debug utilities
export { debugLog as debug };
