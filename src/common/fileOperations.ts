import { readFileSync } from "fs";
import { resolve } from "path";
import { MCPToolError } from "./mcpErrors.ts";

export interface FileReadResult {
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
      throw new MCPToolError(
        `File not found: ${filePath}`,
        "FILE_NOT_FOUND",
        [
          "Check that the file path is correct",
          "Ensure the file exists in the project",
        ],
      );
    }
    throw new MCPToolError(
      `Failed to read file: ${error.message}`,
      "FILE_READ_ERROR",
    );
  }

  return {
    absolutePath,
    fileContent,
    fileUri,
  };
}

/**
 * Check if a file exists and is readable
 * @param root Root directory path
 * @param filePath Relative file path
 * @returns true if file exists and is readable
 */
export function fileExists(root: string, filePath: string): boolean {
  try {
    const absolutePath = resolve(root, filePath);
    readFileSync(absolutePath, "utf-8");
    return true;
  } catch {
    return false;
  }
}
