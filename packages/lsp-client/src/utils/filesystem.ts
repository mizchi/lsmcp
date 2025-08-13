/**
 * File system utilities
 */

import * as fs from "fs";
import * as path from "path";
import type { IFileSystem } from "../interfaces.ts";

export const nodeFileSystemApi: IFileSystem = {
  async readFile(filePath: string, encoding: BufferEncoding = "utf-8"): Promise<string> {
    return fs.promises.readFile(filePath, encoding);
  },

  async writeFile(filePath: string, data: string, encoding?: BufferEncoding): Promise<void> {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, data, encoding || "utf-8");
  },

  async readdir(path: string): Promise<string[]> {
    return fs.promises.readdir(path);
  },

  async stat(path: string): Promise<any> {
    return fs.promises.stat(path);
  },

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  },

  async isDirectory(path: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(path);
      return stats.isDirectory();
    } catch {
      return false;
    }
  },

  async listDirectory(path: string): Promise<string[]> {
    return fs.promises.readdir(path);
  },
};

// Additional file system utilities not in IFileSystem interface
export async function stat(
  filePath: string,
): Promise<{
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  mtime: Date;
}> {
  const stats = await fs.promises.stat(filePath);
  return {
    isFile: stats.isFile(),
    isDirectory: stats.isDirectory(),
    size: stats.size,
    mtime: stats.mtime,
  };
}
