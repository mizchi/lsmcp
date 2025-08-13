/**
 * File system utilities
 */

import * as fs from "fs";
import * as path from "path";
import type { IFileSystem } from "../interfaces.ts";

export const nodeFileSystemApi: IFileSystem = {
  async readFile(filePath: string): Promise<string> {
    return fs.promises.readFile(filePath, "utf-8");
  },

  async writeFile(
    filePath: string,
    data: string | Buffer,
    encoding?: BufferEncoding,
  ): Promise<void> {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, data, encoding || "utf-8");
  },

  async readdir(path: string, options?: any): Promise<any> {
    if (options?.withFileTypes) {
      return fs.promises.readdir(path, options);
    }
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

  async lstat(path: string): Promise<any> {
    return fs.promises.lstat(path);
  },

  async mkdir(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<string | undefined> {
    return fs.promises.mkdir(path, options) as any;
  },

  async rm(
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ): Promise<void> {
    await fs.promises.rm(path, options);
  },

  async realpath(path: string): Promise<string> {
    return fs.promises.realpath(path);
  },

  async cwd(): Promise<string> {
    return process.cwd();
  },

  async resolve(...paths: string[]): Promise<string> {
    return path.resolve(...paths);
  },
};

// Additional file system utilities not in IFileSystem interface
export async function stat(filePath: string): Promise<{
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
