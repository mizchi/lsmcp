import { fileURLToPath, pathToFileURL } from "url";
import { isAbsolute, resolve } from "path";

/**
 * Convert a file URI to a filesystem path
 * Handles Windows paths correctly (file:///C:/path)
 */
export function uriToPath(uri: string): string {
  if (!uri.startsWith("file://")) {
    throw new Error(`Invalid file URI: ${uri}`);
  }

  try {
    return fileURLToPath(uri);
  } catch (error) {
    // Fallback for malformed URIs
    // Remove file:// prefix and handle Windows drive letters
    let path = uri.replace(/^file:\/\/\/?/, "");

    // On Windows, ensure drive letter is formatted correctly
    if (process.platform === "win32") {
      // Convert /C:/path to C:/path
      path = path.replace(/^\/([A-Za-z]):/, "$1:");
    }

    return path;
  }
}

/**
 * Convert a filesystem path to a file URI
 * Handles Windows paths correctly (C:\path -> file:///C:/path)
 */
export function pathToUri(filePath: string): string {
  // Ensure absolute path
  const absolutePath = isAbsolute(filePath) ? filePath : resolve(filePath);

  // pathToFileURL handles Windows paths correctly
  return pathToFileURL(absolutePath).toString();
}

/**
 * Normalize a path for consistent comparison
 * Handles Windows backslashes and case-insensitive filesystems
 */
export function normalizePath(filePath: string): string {
  // Replace backslashes with forward slashes for consistency
  let normalized = filePath.replace(/\\/g, "/");

  // On Windows, normalize drive letter to uppercase
  if (process.platform === "win32") {
    normalized = normalized.replace(/^[a-z]:/, (match) => match.toUpperCase());
  }

  return normalized;
}
