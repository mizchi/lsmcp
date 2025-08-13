/**
 * Performance optimization constants for LSMCP
 */

/**
 * Default concurrency for file operations
 */
export const DEFAULT_CONCURRENCY = 5;

/**
 * Maximum concurrency for file operations
 */
export const MAX_CONCURRENCY = 20;

/**
 * Default batch size for symbol indexing
 */
export const DEFAULT_BATCH_SIZE = 50;

/**
 * Cache TTL in milliseconds (15 minutes)
 */
export const CACHE_TTL = 15 * 60 * 1000;

/**
 * Maximum file size for indexing (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Debounce delay for file watchers (milliseconds)
 */
export const FILE_WATCHER_DEBOUNCE = 500;

/**
 * Maximum response size for MCP tools (characters)
 */
export const MAX_RESPONSE_SIZE = 200000;

/**
 * Timeout for LSP operations (milliseconds)
 */
export const LSP_TIMEOUT = 30000;

/**
 * Memory usage thresholds
 */
export const MEMORY_THRESHOLDS = {
  /**
   * Warning threshold (MB)
   */
  warning: 500,
  /**
   * Critical threshold (MB)
   */
  critical: 1024,
} as const;

/**
 * Symbol index optimization settings
 */
export const INDEX_OPTIMIZATION = {
  /**
   * Minimum file count to trigger incremental indexing
   */
  incrementalThreshold: 100,
  /**
   * Maximum symbols per file before splitting
   */
  maxSymbolsPerFile: 1000,
  /**
   * Enable automatic garbage collection
   */
  enableGC: true,
  /**
   * GC interval in milliseconds
   */
  gcInterval: 5 * 60 * 1000, // 5 minutes
} as const;
