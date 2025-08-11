/**
 * Content hash utilities for file caching
 */

import { createHash } from "crypto";
import { readFile } from "fs/promises";

/**
 * Calculate SHA256 hash of file content
 */
export async function getFileContentHash(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath, "utf-8");
    return createHash("sha256").update(content).digest("hex");
  } catch (error) {
    throw new Error(`Failed to calculate hash for ${filePath}: ${error}`);
  }
}

/**
 * Calculate SHA256 hash of string content
 */
export function getContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * File metadata with content hash
 */
export interface FileMetadata {
  path: string;
  contentHash: string;
  mtime: Date;
  gitHash?: string;
}

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T> {
  data: T;
  metadata: FileMetadata;
  timestamp: Date;
}
