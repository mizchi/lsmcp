/**
 * Memory FileSystem Provider
 * Provides a FileSystemAdapter implementation using MemFileSystemApi
 */

import type { IFs } from "memfs";
import type { FileSystemAdapter, FileSystemProvider } from "@lsmcp/types";
import { MemFileSystemApi } from "../MemFileSystemApi.ts";

/**
 * Memory FileSystem Provider
 * Creates FileSystemAdapter instances using MemFileSystemApi
 */
export class MemFsProvider implements FileSystemProvider {
  constructor(private fs: IFs) {}

  createAdapter(): FileSystemAdapter {
    const memFsApi = new MemFileSystemApi(this.fs);

    // MemFileSystemApi already implements most of the FileSystemAdapter interface
    // We just need to adapt it to the simplified string-only interface
    return {
      readFile: (path: string) => memFsApi.readFile(path, "utf-8"),
      writeFile: (path: string, data: string) =>
        memFsApi.writeFile(path, data, "utf-8"),
      readdir: memFsApi.readdir.bind(memFsApi) as any,
      mkdir: memFsApi.mkdir.bind(memFsApi),
      rm: memFsApi.rm.bind(memFsApi),
      stat: memFsApi.stat.bind(memFsApi),
      lstat: memFsApi.lstat.bind(memFsApi),
      exists: memFsApi.exists.bind(memFsApi),
      realpath: memFsApi.realpath.bind(memFsApi),
      cwd: memFsApi.cwd.bind(memFsApi),
      resolve: memFsApi.resolve.bind(memFsApi),

      // Add utility methods
      isFile: async (path: string) => {
        try {
          const stats = await memFsApi.stat(path);
          return stats.isFile();
        } catch {
          return false;
        }
      },
      isDirectory: async (path: string) => {
        try {
          const stats = await memFsApi.stat(path);
          return stats.isDirectory();
        } catch {
          return false;
        }
      },
    };
  }

  getInfo() {
    return {
      name: "Memory FileSystem",
      type: "memory" as const,
      description: "In-memory file system implementation using memfs",
    };
  }
}
