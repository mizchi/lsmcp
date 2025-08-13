/**
 * Node.js FileSystem implementation
 * Direct implementation of FileSystemApi
 */

import type { FileSystemApi } from "@lsmcp/types";
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
 * Node.js implementation of FileSystemApi
 */
export class NodeFileSystemApi implements FileSystemApi {
  async readFile(path: string): Promise<string> {
    return await readFile(path, "utf-8");
  }

  async writeFile(
    path: string,
    data: string | Buffer,
    encoding?: BufferEncoding,
  ): Promise<void> {
    // Ensure parent directory exists
    const dir = dirname(path);
    await mkdir(dir, { recursive: true }).catch(() => {});
    await writeFile(path, data, encoding || "utf-8");
  }

  async readdir(
    path: string,
    options?: { withFileTypes?: boolean },
  ): Promise<string[] | any[]> {
    if (options?.withFileTypes) {
      return await readdir(path, { withFileTypes: true } as any);
    }
    return await readdir(path);
  }

  async mkdir(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<string | undefined> {
    return await mkdir(path, options);
  }

  async rm(
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ): Promise<void> {
    await rm(path, options);
  }

  async stat(path: string) {
    return await stat(path);
  }

  async lstat(path: string) {
    return await lstat(path);
  }

  async exists(path: string): Promise<boolean> {
    return existsSync(path);
  }

  async realpath(path: string): Promise<string> {
    return await realpath(path);
  }

  async cwd(): Promise<string> {
    return process.cwd();
  }

  async resolve(...paths: string[]): Promise<string> {
    return resolve(...paths);
  }

  // Utility methods
  async isDirectory(path: string): Promise<boolean> {
    try {
      const stats = await stat(path);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async listDirectory(path: string): Promise<string[]> {
    return await readdir(path);
  }
}
