/**
 * MCP Server Logger - Independent logging system for MCP server
 *
 * This logger is separate from the LSP logger and can be controlled independently.
 * Use MCP_DEBUG=1 or LSMCP_DEBUG=1 environment variable to enable MCP server debug logging.
 *
 * IMPORTANT: For MCP servers, all debug output must go to stderr (console.error)
 * since stdout is used for MCP protocol communication.
 */

/**
 * Check if MCP debug logging is enabled
 */
export function isMcpDebugEnabled(): boolean {
  return (
    process.env.MCP_DEBUG === "1" ||
    process.env.MCP_DEBUG === "true" ||
    process.env.LSMCP_DEBUG === "1" ||
    process.env.LSMCP_DEBUG === "true"
  );
}

/**
 * MCP server debug logging function
 *
 * @param args Arguments to log (same as console.error)
 *
 * @example
 * mcpDebug("Processing MCP request:", requestType);
 * mcpDebug("[MCPServer] Handling tool call");
 */
export function mcpDebug(...args: unknown[]): void {
  if (isMcpDebugEnabled()) {
    console.error("[MCP]", ...args);
  }
}

/**
 * MCP server debug logging with custom prefix
 *
 * @param prefix Component prefix (e.g., "Server", "Tool", "Protocol")
 * @param args Arguments to log
 *
 * @example
 * mcpDebugWithPrefix("Tool", "Executing:", toolName);
 * mcpDebugWithPrefix("Protocol", "Received request:", data);
 */
export function mcpDebugWithPrefix(prefix: string, ...args: unknown[]): void {
  if (isMcpDebugEnabled()) {
    console.error(`[MCP:${prefix}]`, ...args);
  }
}

/**
 * MCP server error logging - always shows errors regardless of debug setting
 *
 * @param args Arguments to log
 *
 * @example
 * mcpError("Failed to execute tool:", error.message);
 */
export function mcpError(...args: unknown[]): void {
  console.error("[MCP:ERROR]", ...args);
}

/**
 * MCP server warning logging - always shows warnings regardless of debug setting
 *
 * @param args Arguments to log
 *
 * @example
 * mcpWarn("Tool execution took longer than expected:", duration);
 */
export function mcpWarn(...args: unknown[]): void {
  console.error("[MCP:WARN]", ...args);
}

/**
 * Conditional MCP debug logging
 *
 * @param condition Boolean condition
 * @param args Arguments to log if condition is true
 *
 * @example
 * mcpConditionalDebug(tools.length > 50, "Large tool set:", tools.length);
 */
export function mcpConditionalDebug(
  condition: boolean,
  ...args: unknown[]
): void {
  if (condition && isMcpDebugEnabled()) {
    console.error("[MCP]", ...args);
  }
}

/**
 * MCP performance logging - logs timing information
 *
 * @param operation Operation name
 * @param duration Duration in milliseconds
 *
 * @example
 * mcpPerformance("tool_execution", 500);
 */
export function mcpPerformance(operation: string, duration: number): void {
  if (isMcpDebugEnabled()) {
    console.error(`[MCP:PERF] ${operation} took ${duration}ms`);
  }
}

/**
 * MCP data logging - logs data structures with pretty printing
 *
 * @param label Label for the data
 * @param data Data to log
 *
 * @example
 * mcpData("Tool parameters", params);
 */
export function mcpData(label: string, data: unknown): void {
  if (isMcpDebugEnabled()) {
    console.error(`[MCP:DATA] ${label}:`, JSON.stringify(data, null, 2));
  }
}

/**
 * MCP tool logging - specific logging for tool execution
 *
 * @param toolName Name of the tool
 * @param phase Phase of execution ("start", "end", "error")
 * @param details Additional details
 *
 * @example
 * mcpTool("get_symbols", "start", { file: "test.ts" });
 * mcpTool("get_symbols", "end", { symbols: 10, duration: 100 });
 */
export function mcpTool(
  toolName: string,
  phase: "start" | "end" | "error",
  details?: unknown,
): void {
  if (isMcpDebugEnabled()) {
    const prefix = phase === "error" ? "[MCP:TOOL:ERROR]" : "[MCP:TOOL]";
    console.error(
      `${prefix} ${toolName} - ${phase}`,
      details ? JSON.stringify(details, null, 2) : "",
    );
  }
}

// Backward compatibility with existing debugLog
export { mcpDebug as debugLog };
export { mcpDebugWithPrefix as debugLogWithPrefix };
export { mcpError as errorLog };
export { mcpConditionalDebug as conditionalDebug };

// Re-export as default debug for backward compatibility
export { mcpDebug as debug };
