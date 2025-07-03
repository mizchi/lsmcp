/**
 * File system interface for abstraction
 * Allows using either real fs or memfs for testing
 */

export interface FileSystem {
  readFileSync(path: string, encoding: BufferEncoding): string;
  writeFileSync(path: string, data: string, encoding?: BufferEncoding): void;
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  unlinkSync(path: string): void;
  readdirSync(path: string): string[];
  statSync(path: string): {
    isFile(): boolean;
    isDirectory(): boolean;
    size: number;
    mtime: Date;
  };
}

// Default implementation using Node.js fs
import * as fs from "fs";

export const nodeFs: FileSystem = {
  readFileSync: (path, encoding) => fs.readFileSync(path, encoding),
  writeFileSync: (path, data, encoding) =>
    fs.writeFileSync(path, data, encoding),
  existsSync: (path) => fs.existsSync(path),
  mkdirSync: (path, options) => fs.mkdirSync(path, options),
  unlinkSync: (path) => fs.unlinkSync(path),
  readdirSync: (path) => fs.readdirSync(path),
  statSync: (path) => fs.statSync(path),
};
