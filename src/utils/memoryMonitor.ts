/**
 * Memory usage monitoring utilities
 */

import { MEMORY_THRESHOLDS } from "../constants/performance.ts";
import { debug } from "./mcpHelpers.ts";

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

/**
 * Get current memory usage statistics
 */
export function getMemoryStats(): MemoryStats {
  const memUsage = process.memoryUsage();
  return {
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    external: memUsage.external,
    rss: memUsage.rss,
  };
}

/**
 * Get memory usage in MB
 */
export function getMemoryUsageMB(): number {
  return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
}

/**
 * Check if memory usage is above warning threshold
 */
export function isMemoryWarning(): boolean {
  const usageMB = getMemoryUsageMB();
  return usageMB > MEMORY_THRESHOLDS.warning;
}

/**
 * Check if memory usage is critical
 */
export function isMemoryCritical(): boolean {
  const usageMB = getMemoryUsageMB();
  return usageMB > MEMORY_THRESHOLDS.critical;
}

/**
 * Log memory usage
 */
export function logMemoryUsage(context?: string): void {
  const usageMB = getMemoryUsageMB();
  const level = isMemoryCritical()
    ? "CRITICAL"
    : isMemoryWarning()
      ? "WARNING"
      : "INFO";

  debug(
    `[MEMORY ${level}] ${context || "Current usage"}: ${usageMB}MB / ${
      MEMORY_THRESHOLDS.critical
    }MB`,
  );
}

/**
 * Force garbage collection if available
 */
export function forceGC(): void {
  if (global.gc) {
    const beforeMB = getMemoryUsageMB();
    global.gc();
    const afterMB = getMemoryUsageMB();
    debug(`[GC] Freed ${beforeMB - afterMB}MB (${beforeMB}MB -> ${afterMB}MB)`);
  }
}

/**
 * Monitor memory usage and trigger GC if needed
 */
export class MemoryMonitor {
  private interval?: NodeJS.Timeout;

  start(intervalMs: number = 60000): void {
    this.stop();
    this.interval = setInterval(() => {
      if (isMemoryCritical()) {
        debug("[MEMORY] Critical memory usage detected, triggering GC");
        forceGC();
      } else if (isMemoryWarning()) {
        logMemoryUsage("Memory warning");
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
}

// Singleton instance
export const memoryMonitor = new MemoryMonitor();
