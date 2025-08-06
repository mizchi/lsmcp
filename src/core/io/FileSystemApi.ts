import type { Stats } from "node:fs";

export interface FileSystemApi {
  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  readFile(path: string): Promise<Buffer>;
  writeFile(
    path: string,
    data: string | Buffer,
    encoding?: BufferEncoding,
  ): Promise<void>;
  readdir(path: string): Promise<string[]>;
  readdir(path: string, options: { withFileTypes: true }): Promise<any[]>;
  readdir(
    path: string,
    options?: { withFileTypes?: boolean },
  ): Promise<string[] | any[]>;
  stat(path: string): Promise<Stats>;
  lstat(path: string): Promise<Stats>;
  exists(path: string): Promise<boolean>;
  mkdir(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<string | undefined>;
  rm(
    path: string,
    options?: { recursive?: boolean; force?: boolean },
  ): Promise<void>;
  realpath(path: string): Promise<string>;
}
