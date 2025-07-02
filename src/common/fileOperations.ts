import { readFileSync } from "fs";
import { resolve } from "path";
import { ErrorCode, errors } from "./errors/index.ts";

interface FileReadResult {
  absolutePath: string;
  fileContent: string;
  fileUri: string;
}

/**
 * Read a file and return its content along with path information
 * @param root Root directory path
 * @param filePath Relative file path
 * @returns FileReadResult with absolutePath, fileContent, and fileUri
 * @throws MCPToolError if file cannot be read
 */
export function readFileWithMetadata(
  root: string,
  filePath: string,
): FileReadResult {
  const absolutePath = resolve(root, filePath);
  const fileUri = `file://${absolutePath}`;

  let fileContent: string;
  try {
    fileContent = readFileSync(absolutePath, "utf-8");
  } catch (error: any) {
    if (error.code === "ENOENT") {
      throw errors.fileNotFound(filePath);
    }
    throw errors.generic(
      `Failed to read file: ${error.message}`,
      ErrorCode.FILE_READ_ERROR,
      { filePath },
    );
  }

  return {
    absolutePath,
    fileContent,
    fileUri,
  };
}
