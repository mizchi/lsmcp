/**
 * Node.js file system implementation
 */

import { readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import type { FileSystem } from "./types.ts";

export class NodeFileSystem implements FileSystem {
  async readFile(path: string): Promise<string> {
    return await readFile(path, "utf-8");
  }

  async exists(path: string): Promise<boolean> {
    return existsSync(path);
  }

  async stat(path: string): Promise<{ mtime: Date }> {
    const stats = await stat(path);
    return { mtime: stats.mtime };
  }
}
