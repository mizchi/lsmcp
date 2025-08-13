import { readFileSync } from "fs";
import { pathToFileURL } from "url";
import path from "path";

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
  const absolutePath = path.resolve(root, filePath);

  try {
    const content = readFileSync(absolutePath, "utf-8");
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
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    throw new Error(`Failed to parse JSON from ${filePath}: ${error}`);
  }
}
