/**
 * Node.js file system implementation
 */

import * as fs from "fs/promises";
import { existsSync } from "fs";
import * as path from "path";
import type { FileSystemApi } from "@internal/types";

export class NodeFileSystem implements FileSystemApi {
  async readFile(path: string): Promise<string> {
    return await fs.readFile(path, "utf-8");
  }

  async writeFile(
    path: string,
    data: string | Buffer,
    encoding?: BufferEncoding,
  ): Promise<void> {
    await fs.writeFile(path, data, encoding || "utf-8");
  }

  async readdir(path: string, options?: any): Promise<any> {
    if (options?.withFileTypes) {
      return fs.readdir(path, options);
    }
    return fs.readdir(path);
  }

  async exists(path: string): Promise<boolean> {
    return existsSync(path);
  }

  async stat(path: string): Promise<any> {
    return await fs.stat(path);
  }

  async lstat(path: string): Promise<any> {
    return await fs.lstat(path);
  }

  async mkdir(
    dirPath: string,
    options?: { recursive?: boolean },
  ): Promise<string | undefined> {
    return (await fs.mkdir(dirPath, options)) as any;
  }

  async rm(
    dirPath: string,
    options?: { recursive?: boolean; force?: boolean },
  ): Promise<void> {
    await fs.rm(dirPath, options);
  }

  async realpath(dirPath: string): Promise<string> {
    return await fs.realpath(dirPath);
  }

  async cwd(): Promise<string> {
    return process.cwd();
  }

  async resolve(...paths: string[]): Promise<string> {
    return path.resolve(...paths);
  }

  async isDirectory(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async listDirectory(dirPath: string): Promise<string[]> {
    return await fs.readdir(dirPath);
  }
}
