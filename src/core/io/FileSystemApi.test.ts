import { describe, it, expect } from "vitest";
import { createFsFromVolume, Volume } from "memfs";
import { NodeFileSystemApi } from "./NodeFileSystemApi.ts";
import { MemFileSystemApi } from "./MemFileSystemApi.ts";
import type { FileSystemApi } from "./FileSystemApi.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("FileSystemApi implementations", () => {
  const testCases = (
    name: string,
    createFs: () => { fs: FileSystemApi; cleanup?: () => void },
  ) => {
    describe(name, () => {
      it("should read and write files", async () => {
        const { fs, cleanup } = createFs();
        try {
          const path = "/test.txt";
          const content = "Hello, World!";

          await fs.writeFile(path, content, "utf-8");
          const read = await fs.readFile(path, "utf-8");

          expect(read).toBe(content);
        } finally {
          cleanup?.();
        }
      });

      it("should handle binary files", async () => {
        const { fs, cleanup } = createFs();
        try {
          const path = "/binary.dat";
          const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);

          await fs.writeFile(path, buffer);
          const read = await fs.readFile(path);

          expect(Buffer.isBuffer(read)).toBe(true);
          expect(read).toEqual(buffer);
        } finally {
          cleanup?.();
        }
      });

      it("should create directories", async () => {
        const { fs, cleanup } = createFs();
        try {
          const dir = "/my/nested/dir";

          await fs.mkdir(dir, { recursive: true });
          const exists = await fs.exists(dir);

          expect(exists).toBe(true);
        } finally {
          cleanup?.();
        }
      });

      it("should list directory contents", async () => {
        const { fs, cleanup } = createFs();
        try {
          await fs.writeFile("/dir/file1.txt", "content1", "utf-8");
          await fs.writeFile("/dir/file2.txt", "content2", "utf-8");

          const files = await fs.readdir("/dir");

          expect(files.sort()).toEqual(["file1.txt", "file2.txt"]);
        } finally {
          cleanup?.();
        }
      });

      it("should remove files and directories", async () => {
        const { fs, cleanup } = createFs();
        try {
          await fs.writeFile("/temp/file.txt", "temp", "utf-8");

          await fs.rm("/temp/file.txt");
          const fileExists = await fs.exists("/temp/file.txt");
          expect(fileExists).toBe(false);

          await fs.rm("/temp", { recursive: true });
          const dirExists = await fs.exists("/temp");
          expect(dirExists).toBe(false);
        } finally {
          cleanup?.();
        }
      });

      it("should get file stats", async () => {
        const { fs, cleanup } = createFs();
        try {
          const content = "test content";
          await fs.writeFile("/stats.txt", content, "utf-8");

          const stats = await fs.stat("/stats.txt");

          expect(stats.isFile()).toBe(true);
          expect(stats.size).toBe(content.length);
        } finally {
          cleanup?.();
        }
      });
    });
  };

  // Test MemFileSystemApi
  testCases("MemFileSystemApi", () => {
    const vol = new Volume();
    const memfs = createFsFromVolume(vol);
    return { fs: new MemFileSystemApi(memfs) };
  });

  // Test NodeFileSystemApi with temp directory
  testCases("NodeFileSystemApi", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "lsmcp-test-"));
    const fs = new NodeFileSystemApi();

    // Create a wrapper that prefixes all paths with tempDir
    const wrappedFs: FileSystemApi = {
      readFile: ((path: string, encoding?: BufferEncoding) =>
        fs.readFile(
          join(tempDir, path),
          encoding!,
        )) as FileSystemApi["readFile"],
      writeFile: (path, data, encoding) =>
        fs.writeFile(join(tempDir, path), data, encoding),
      readdir: (path) => fs.readdir(join(tempDir, path)),
      stat: (path) => fs.stat(join(tempDir, path)),
      lstat: (path) => fs.lstat(join(tempDir, path)),
      exists: (path) => fs.exists(join(tempDir, path)),
      mkdir: (path, options) => fs.mkdir(join(tempDir, path), options),
      rm: (path, options) => fs.rm(join(tempDir, path), options),
      realpath: (path) => fs.realpath(join(tempDir, path)),
    };

    return {
      fs: wrappedFs,
      cleanup: () => rmSync(tempDir, { recursive: true, force: true }),
    };
  });
});
