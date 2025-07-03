import { resolve } from "path";
import { ErrorCode, errors } from "../pure/errors/index.ts";
import { FileSystem, nodeFs } from "./fs-interface.ts";

interface FileReadResult {
  absolutePath: string;
  fileContent: string;
  fileUri: string;
}

/**
 * Read a file and return its content along with path information
 * @param root Root directory path
 * @param filePath Relative file path
 * @param fs File system implementation (defaults to Node.js fs)
 * @returns FileReadResult with absolutePath, fileContent, and fileUri
 * @throws MCPToolError if file cannot be read
 */
export function readFileWithMetadata(
  root: string,
  filePath: string,
  fs: FileSystem = nodeFs,
): FileReadResult {
  const absolutePath = resolve(root, filePath);
  const fileUri = `file://${absolutePath}`;

  let fileContent: string;
  try {
    fileContent = fs.readFileSync(absolutePath, "utf-8");
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
  fs: FileSystem = nodeFs,
): boolean {
  const absolutePath = resolve(root, filePath);
  return fs.existsSync(absolutePath);
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
  fs: FileSystem = nodeFs,
): void {
  const absolutePath = resolve(root, filePath);

  try {
    // Ensure directory exists
    const dir = resolve(absolutePath, "..");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(absolutePath, content, "utf-8");
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
    let memFs: FileSystem;

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
