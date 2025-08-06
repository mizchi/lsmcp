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
import type { FileSystemApi } from "./FileSystemApi.ts";

export class NodeFileSystemApi implements FileSystemApi {
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  readFile(path: string): Promise<Buffer>;
  async readFile(
    path: string,
    encoding?: BufferEncoding,
  ): Promise<string | Buffer> {
    if (encoding) {
      return await readFile(path, encoding);
    }
    return await readFile(path);
  }

  async writeFile(
    path: string,
    data: string | Buffer,
    encoding?: BufferEncoding,
  ): Promise<void> {
    // Ensure parent directory exists
    const { dirname } = await import("node:path");
    const dir = dirname(path);
    await mkdir(dir, { recursive: true }).catch(() => {}); // Ignore error if dir exists

    await writeFile(path, data, encoding);
  }

  readdir(path: string): Promise<string[]>;
  readdir(path: string, options: { withFileTypes: true }): Promise<any[]>;
  async readdir(
    path: string,
    options?: { withFileTypes?: boolean },
  ): Promise<string[] | any[]> {
    if (options?.withFileTypes) {
      return await readdir(path, { withFileTypes: true } as any);
    }
    return await readdir(path);
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

  async realpath(path: string): Promise<string> {
    return await realpath(path);
  }
}

export const nodeFileSystemApi = new NodeFileSystemApi();
