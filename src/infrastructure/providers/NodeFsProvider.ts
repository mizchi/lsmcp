/**
 * Node.js FileSystem Provider
 * Direct implementation of FileSystemAdapter
 */

import type { FileSystemAdapter, FileSystemProvider } from "@lsmcp/types";
import {
  readFile,
  writeFile,
  readdir,
  stat,
  lstat,
  mkdir,
  rm,
  realpath,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { dirname } from "node:path";

/**
 * Node.js FileSystem Provider
 * Creates FileSystemAdapter instances for Node.js file system
 */
export class NodeFsProvider implements FileSystemProvider {
  createAdapter(): FileSystemAdapter {
    return {
      readFile: async (path: string) => await readFile(path, "utf-8"),

      writeFile: async (path: string, data: string) => {
        // Ensure parent directory exists
        const dir = dirname(path);
        await mkdir(dir, { recursive: true }).catch(() => {});
        await writeFile(path, data, "utf-8");
      },

      readdir: async (path: string, options?: any) => {
        if (options?.withFileTypes) {
          return await readdir(path, { withFileTypes: true } as any);
        }
        return await readdir(path);
      },

      mkdir: async (path: string, options?: { recursive?: boolean }) =>
        await mkdir(path, options),

      rm: async (
        path: string,
        options?: { recursive?: boolean; force?: boolean },
      ) => await rm(path, options),

      stat: async (path: string) => await stat(path),
      lstat: async (path: string) => await lstat(path),
      exists: async (path: string) => existsSync(path),
      realpath: async (path: string) => await realpath(path),
      cwd: async () => process.cwd(),
      resolve: async (...paths: string[]) => resolve(...paths),

      // Utility methods
      isFile: async (path: string) => {
        try {
          const stats = await stat(path);
          return stats.isFile();
        } catch {
          return false;
        }
      },
      isDirectory: async (path: string) => {
        try {
          const stats = await stat(path);
          return stats.isDirectory();
        } catch {
          return false;
        }
      },
    };
  }

  getInfo() {
    return {
      name: "Node.js FileSystem",
      type: "node" as const,
      description: "Native Node.js file system implementation",
    };
  }
}

// Export singleton instance for convenience
export const nodeFsProvider = new NodeFsProvider();
