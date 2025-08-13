import { resolve } from "path";
import { pathToFileURL } from "url";
import { ErrorCode, errors } from "../domain/errors/index.ts";
import * as fs from "fs";

interface FileReadResult {
  absolutePath: string;
  fileContent: string;
  fileUri: string;
}

/**
 * Read a file and return its content along with path information
 * @param root Root directory path
 * @param filePath Relative file path
 * @param fileSystem File system implementation (defaults to Node.js fs)
 * @returns FileReadResult with absolutePath, fileContent, and fileUri
 * @throws MCPToolError if file cannot be read
 */
// For testing purposes, fs can be overridden
interface FileSystemLike {
  readFileSync(path: string, encoding: BufferEncoding): string;
  writeFileSync(path: string, data: string, encoding?: BufferEncoding): void;
  existsSync(path: string): boolean;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  unlinkSync(path: string): void;
  readdirSync(path: string): string[];
  statSync(path: string): any;
}

export function readFileWithMetadata(
  root: string,
  filePath: string,
  fileSystem: FileSystemLike = fs,
): FileReadResult {
  const absolutePath = resolve(root, filePath);
  const fileUri = `file://${absolutePath}`;

  let fileContent: string;
  try {
    fileContent = fileSystem.readFileSync(absolutePath, "utf-8");
  } catch (error: any) {
    if (error.code === "ENOENT") {
      throw errors.fileNotFound(filePath);
    }
    if (error.code === "EISDIR") {
      throw errors.generic(
        `'${filePath}' is a directory, not a file`,
        ErrorCode.INVALID_PARAMETER,
        { filePath },
      );
    }
    if (error.code === "EACCES") {
      throw errors.filePermission(filePath);
    }
    throw errors.fileRead(filePath, error.message);
  }

  return {
    absolutePath,
    fileContent,
    fileUri,
  };
}

/**
 * Check if a file exists
 * @param root Root directory path
 * @param filePath Relative file path
 * @param fs File system implementation (defaults to Node.js fs)
 * @returns true if file exists
 */
export function fileExists(
  root: string,
  filePath: string,
  fileSystem: FileSystemLike = fs,
): boolean {
  const absolutePath = resolve(root, filePath);
  return fileSystem.existsSync(absolutePath);
}

/**
 * Write content to a file
 * @param root Root directory path
 * @param filePath Relative file path
 * @param content File content to write
 * @param fs File system implementation (defaults to Node.js fs)
 * @throws MCPToolError if file cannot be written
 */
export function writeFile(
  root: string,
  filePath: string,
  content: string,
  fileSystem: FileSystemLike = fs,
): void {
  const absolutePath = resolve(root, filePath);

  try {
    // Ensure directory exists
    const dir = resolve(absolutePath, "..");
    if (!fileSystem.existsSync(dir)) {
      fileSystem.mkdirSync(dir, { recursive: true });
    }

    fileSystem.writeFileSync(absolutePath, content, "utf-8");
  } catch (error: any) {
    if (error.code === "EACCES") {
      throw errors.filePermission(filePath);
    }
    throw errors.fileWrite(filePath, error.message);
  }
}

// In-source tests using Vitest
if (import.meta.vitest) {
  const { describe, it, expect, beforeEach } = import.meta.vitest;
  const { Volume } = await import("memfs");

  describe("fileOperations with memfs", () => {
    let vol: any;
    let memFs: FileSystemLike;

    beforeEach(() => {
      vol = new Volume();
      memFs = {
        readFileSync: (path, encoding) => vol.readFileSync(path, encoding),
        writeFileSync: (path, data, encoding) =>
          vol.writeFileSync(path, data, encoding),
        existsSync: (path) => vol.existsSync(path),
        mkdirSync: (path, options) => vol.mkdirSync(path, options),
        unlinkSync: (path) => vol.unlinkSync(path),
        readdirSync: (path) => vol.readdirSync(path),
        statSync: (path) => vol.statSync(path),
      };
    });

    describe("readFileWithMetadata", () => {
      it("should read file content and return metadata", () => {
        // Create test file in memory
        vol.fromJSON({
          "/project/test.ts": "const hello = 'world';",
        });

        const result = readFileWithMetadata("/project", "test.ts", memFs);

        expect(result).toEqual({
          absolutePath: "/project/test.ts",
          fileContent: "const hello = 'world';",
          fileUri: "file:///project/test.ts",
        });
      });

      it("should throw fileNotFound error for non-existent file", () => {
        expect(() => {
          readFileWithMetadata("/project", "missing.ts", memFs);
        }).toThrow("File not found: missing.ts");
      });

      it("should throw invalidOperation error for directory", () => {
        vol.mkdirSync("/project/src", { recursive: true });

        expect(() => {
          readFileWithMetadata("/project", "src", memFs);
        }).toThrow("'src' is a directory, not a file");
      });
    });

    describe("fileExists", () => {
      it("should return true for existing file", () => {
        vol.fromJSON({
          "/project/exists.ts": "content",
        });

        const exists = fileExists("/project", "exists.ts", memFs);
        expect(exists).toBe(true);
      });

      it("should return false for non-existing file", () => {
        const exists = fileExists("/project", "missing.ts", memFs);
        expect(exists).toBe(false);
      });
    });

    describe("writeFile", () => {
      it("should write content to file", () => {
        writeFile("/project", "new.ts", "export const x = 1;", memFs);

        const content = vol.readFileSync("/project/new.ts", "utf-8");
        expect(content).toBe("export const x = 1;");
      });

      it("should create directories if they don't exist", () => {
        writeFile("/project", "src/nested/file.ts", "content", memFs);

        expect(vol.existsSync("/project/src/nested/file.ts")).toBe(true);
        expect(vol.readFileSync("/project/src/nested/file.ts", "utf-8")).toBe(
          "content",
        );
      });
    });
  });
}

/**
 * Read file content and generate file URI
 * @param root Root directory path
 * @param filePath Relative file path
 * @returns File content and URI
 * @throws Error if file not found
 */
export function readFileWithUri(
  root: string,
  filePath: string,
): {
  content: string;
  uri: string;
  absolutePath: string;
} {
  const absolutePath = resolve(root, filePath);

  try {
    const content = fs.readFileSync(absolutePath, "utf-8");
    const uri = pathToFileURL(absolutePath).toString();
    return { content, uri, absolutePath };
  } catch (error) {
    throw new Error(`File not found: ${filePath}`);
  }
}

/**
 * Read JSON file and parse it
 * @param filePath Absolute or relative file path
 * @returns Parsed JSON object
 * @throws Error if file not found or invalid JSON
 */
export function readJsonFile<T = unknown>(filePath: string): T {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    throw new Error(`Failed to parse JSON from ${filePath}: ${error}`);
  }
}
