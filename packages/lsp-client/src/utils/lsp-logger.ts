/**
 * LSP Client Logger - Independent logging system for LSP client
 *
 * This logger is separate from the MCP logger and can be controlled independently.
 * Use LSP_DEBUG=1 environment variable to enable LSP client debug logging.
 */

/**
 * Check if LSP debug logging is enabled
 */
export function isLspDebugEnabled(): boolean {
  return process.env.LSP_DEBUG === "1" || process.env.LSP_DEBUG === "true";
}

/**
 * LSP client debug logging function
 *
 * @param args Arguments to log (same as console.error)
 *
 * @example
 * lspDebug("Processing LSP request:", requestType);
 * lspDebug("[LSPClient] Connected to server");
 */
export function lspDebug(...args: unknown[]): void {
  if (isLspDebugEnabled()) {
    console.error("[LSP]", ...args);
  }
}

/**
 * LSP client debug logging with custom prefix
 *
 * @param prefix Component prefix (e.g., "Client", "Server", "Protocol")
 * @param args Arguments to log
 *
 * @example
 * lspDebugWithPrefix("Client", "Sending request:", method);
 * lspDebugWithPrefix("Protocol", "Received response:", data);
 */
export function lspDebugWithPrefix(prefix: string, ...args: unknown[]): void {
  if (isLspDebugEnabled()) {
    console.error(`[LSP:${prefix}]`, ...args);
  }
}

/**
 * LSP client error logging - always shows errors regardless of debug setting
 *
 * @param args Arguments to log
 *
 * @example
 * lspError("Failed to connect to LSP server:", error.message);
 */
export function lspError(...args: unknown[]): void {
  console.error("[LSP:ERROR]", ...args);
}

/**
 * LSP client warning logging - always shows warnings regardless of debug setting
 *
 * @param args Arguments to log
 *
 * @example
 * lspWarn("LSP server responded slowly:", responseTime);
 */
export function lspWarn(...args: unknown[]): void {
  console.error("[LSP:WARN]", ...args);
}

/**
 * Conditional LSP debug logging
 *
 * @param condition Boolean condition
 * @param args Arguments to log if condition is true
 *
 * @example
 * lspConditionalDebug(files.length > 100, "Large file set:", files.length);
 */
export function lspConditionalDebug(
  condition: boolean,
  ...args: unknown[]
): void {
  if (condition && isLspDebugEnabled()) {
    console.error("[LSP]", ...args);
  }
}

/**
 * LSP performance logging - logs timing information
 *
 * @param operation Operation name
 * @param duration Duration in milliseconds
 *
 * @example
 * lspPerformance("initialize", 1234);
 */
export function lspPerformance(operation: string, duration: number): void {
  if (isLspDebugEnabled()) {
    console.error(`[LSP:PERF] ${operation} took ${duration}ms`);
  }
}

/**
 * LSP data logging - logs data structures with pretty printing
 *
 * @param label Label for the data
 * @param data Data to log
 *
 * @example
 * lspData("Server capabilities", capabilities);
 */
export function lspData(label: string, data: unknown): void {
  if (isLspDebugEnabled()) {
    console.error(`[LSP:DATA] ${label}:`, JSON.stringify(data, null, 2));
  }
}

// Backward compatibility exports
export { lspDebug as debugLog };
export { lspDebugWithPrefix as debug };
