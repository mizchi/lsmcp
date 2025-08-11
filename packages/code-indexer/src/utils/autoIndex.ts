/**
 * Auto-indexing utilities for updating the index after file modifications
 */

import { updateIndexIncremental } from "../mcp/IndexerAdapter.ts";
import { relative } from "path";

// Track modified files that need re-indexing
const modifiedFiles = new Set<string>();
let updateTimer: NodeJS.Timeout | null = null;

/**
 * Mark a file as modified and schedule an index update
 */
export function markFileModified(rootPath: string, filePath: string): void {
  const relativePath = relative(rootPath, filePath);
  modifiedFiles.add(relativePath);

  // Cancel existing timer
  if (updateTimer) {
    clearTimeout(updateTimer);
  }

  // Schedule update after a short delay to batch multiple changes
  updateTimer = setTimeout(() => {
    performAutoIndex(rootPath);
  }, 500); // 500ms delay
}

/**
 * Perform automatic incremental index update
 */
async function performAutoIndex(rootPath: string): Promise<void> {
  if (modifiedFiles.size === 0) return;

  try {
    // Clear the set before updating to handle concurrent modifications
    modifiedFiles.clear();

    // Perform incremental update
    const result = await updateIndexIncremental(rootPath);

    if (!result.success) {
      console.error("Auto-index failed:", result.errors);
    }
  } catch (error) {
    console.error("Auto-index error:", error);
  }
}

/**
 * Force immediate index update without waiting
 */
export async function forceAutoIndex(rootPath: string): Promise<void> {
  if (updateTimer) {
    clearTimeout(updateTimer);
    updateTimer = null;
  }

  await performAutoIndex(rootPath);
}
