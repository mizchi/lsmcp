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

  async writeFile(filePath: string, content: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content, "utf-8");
  },

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  },

  async mkdir(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true });
  },

  async readdir(dirPath: string): Promise<string[]> {
    return fs.promises.readdir(dirPath);
  },

  async stat(
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
  },
};
