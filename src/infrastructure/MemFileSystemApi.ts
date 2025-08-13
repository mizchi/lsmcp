import type { FileSystemApi } from "@lsmcp/types";
import type { IFs } from "memfs";
import type { Stats } from "node:fs";
import { dirname, resolve } from "node:path";

export class MemFileSystemApi implements FileSystemApi {
  constructor(private fs: IFs) {}

  async readFile(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.fs.readFile(path, "utf-8", (err, data) => {
        if (err) reject(err);
        else resolve(data as string);
      });
    });
  }

  async writeFile(
    path: string,
    data: string | Buffer,
    encoding?: BufferEncoding,
  ): Promise<void> {
    // Ensure parent directory exists
    const dir = dirname(path);
    await this.mkdir(dir, { recursive: true });

    return new Promise((resolve, reject) => {
      if (encoding && typeof data === "string") {
        this.fs.writeFile(path, data, encoding, (err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        this.fs.writeFile(path, data, (err) => {
          if (err) reject(err);
          else resolve();
        });
      }
    });
  }

  readdir(path: string): Promise<string[]>;
  readdir(path: string, options: { withFileTypes: true }): Promise<any[]>;
  async readdir(
    path: string,
    options?: { withFileTypes?: boolean },
  ): Promise<string[] | any[]> {
    return new Promise((resolve, reject) => {
      if (options?.withFileTypes) {
        // For memfs, we need to cast the fs to access readdir with options
        (this.fs as any).readdir(
          path,
          { withFileTypes: true },
          (err: any, files: any) => {
            if (err) reject(err);
            else resolve(files);
          },
        );
      } else {
        this.fs.readdir(path, (err, files) => {
          if (err) reject(err);
          else resolve(files as string[]);
        });
      }
    });
  }

  async stat(path: string): Promise<Stats> {
    return new Promise((resolve, reject) => {
      this.fs.stat(path, (err, stats) => {
        if (err) reject(err);
        else resolve(stats as Stats);
      });
    });
  }

  async lstat(path: string): Promise<Stats> {
    return new Promise((resolve, reject) => {
      this.fs.lstat(path, (err, stats) => {
        if (err) reject(err);
        else resolve(stats as Stats);
      });
    });
  }

  async exists(path: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.fs.exists(path, (exists) => {
        resolve(exists);
      });
    });
  }

  async mkdir(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      this.fs.mkdir(path, options || {}, (err) => {
        if (err && (!options?.recursive || err.code !== "EEXIST")) {
          reject(err);
        } else {
          resolve(path);
        }
      });
    });
  }

  async rm(
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (options?.recursive) {
        // memfs doesn't have built-in recursive rm, so we implement it
        this.removeRecursive(path).then(resolve).catch(reject);
      } else {
        this.fs.unlink(path, (err) => {
          if (err && (!options?.force || err.code !== "ENOENT")) {
            reject(err);
          } else {
            resolve();
          }
        });
      }
    });
  }

  async realpath(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.fs.realpath(path, (err, resolvedPath) => {
        if (err) reject(err);
        else resolve(resolvedPath as string);
      });
    });
  }

  async cwd(): Promise<string> {
    return process.cwd();
  }

  async resolve(...paths: string[]): Promise<string> {
    return resolve(...paths);
  }

  private async removeRecursive(path: string): Promise<void> {
    const stats = await this.stat(path);

    if (stats.isDirectory()) {
      const files = await this.readdir(path);
      await Promise.all(
        files.map((file) => this.removeRecursive(`${path}/${file}`)),
      );
      await new Promise<void>((resolve, reject) => {
        this.fs.rmdir(path, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      await new Promise<void>((resolve, reject) => {
        this.fs.unlink(path, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
}
