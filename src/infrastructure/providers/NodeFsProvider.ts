/**
 * Node.js FileSystem Provider
 * Provides a FileSystemAdapter implementation using NodeFileSystemApi
 */

import type { FileSystemAdapter, FileSystemProvider } from "@lsmcp/types";
import { nodeFileSystemApi } from "../NodeFileSystemApi.ts";

/**
 * Node.js FileSystem Provider
 * Creates FileSystemAdapter instances using NodeFileSystemApi
 */
export class NodeFsProvider implements FileSystemProvider {
  createAdapter(): FileSystemAdapter {
    // NodeFileSystemApi already implements most of the FileSystemAdapter interface
    // We just need to adapt it to the simplified string-only interface
    return {
      readFile: (path: string) => nodeFileSystemApi.readFile(path, "utf-8"),
      writeFile: (path: string, data: string) =>
        nodeFileSystemApi.writeFile(path, data, "utf-8"),
      readdir: nodeFileSystemApi.readdir.bind(nodeFileSystemApi) as any,
      mkdir: nodeFileSystemApi.mkdir.bind(nodeFileSystemApi),
      rm: nodeFileSystemApi.rm.bind(nodeFileSystemApi),
      stat: nodeFileSystemApi.stat.bind(nodeFileSystemApi),
      lstat: nodeFileSystemApi.lstat.bind(nodeFileSystemApi),
      exists: nodeFileSystemApi.exists.bind(nodeFileSystemApi),
      realpath: nodeFileSystemApi.realpath.bind(nodeFileSystemApi),
      cwd: nodeFileSystemApi.cwd.bind(nodeFileSystemApi),
      resolve: nodeFileSystemApi.resolve.bind(nodeFileSystemApi),

      // Add utility methods
      isFile: async (path: string) => {
        try {
          const stats = await nodeFileSystemApi.stat(path);
          return stats.isFile();
        } catch {
          return false;
        }
      },
      isDirectory: async (path: string) => {
        try {
          const stats = await nodeFileSystemApi.stat(path);
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
