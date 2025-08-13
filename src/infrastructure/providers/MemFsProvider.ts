/**
 * Memory FileSystem API implementation
 * This file is kept for backward compatibility
 * but delegates to MemFileSystemApi
 */

import type { IFs } from "memfs";
import { MemFileSystemApi } from "../MemFileSystemApi.ts";

/**
 * Create a memory-based FileSystemApi instance
 */
export function createMemFileSystemApi(fs: IFs): MemFileSystemApi {
  return new MemFileSystemApi(fs);
}
