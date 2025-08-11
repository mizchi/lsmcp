/**
 * Code indexer constants
 */

// Cache constants
export const SYMBOL_CACHE_SCHEMA_VERSION = 2;
export const INDEX_BATCH_SIZE = 10; // Files to process in parallel
export const INDEX_CONCURRENCY_DEFAULT = 5;
export const INDEX_CONCURRENCY_MAX = 20;
export const INDEX_CONCURRENCY_MIN = 1;

// Token compression
export const AVERAGE_TOKEN_COMPRESSION_RATIO = 0.97; // 97% compression
