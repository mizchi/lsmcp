import { existsSync } from "fs";
import { join } from "path";
import { platform } from "os";
import { execSync } from "child_process";

/**
 * Get the path to a binary in node_modules/.bin/
 * This is faster than using npx which has significant overhead
 *
 * @param binName - The name of the binary (e.g., "typescript-language-server")
 * @param projectRoot - Optional project root to search from (defaults to cwd)
 * @returns The full path to the binary, or null if not found
 */
export function getNodeModulesBin(
  binName: string,
  projectRoot?: string,
): string | null {
  const isWindows = platform() === "win32";
  const executableName = isWindows ? `${binName}.cmd` : binName;

  // Start from project root or current directory
  let currentDir = projectRoot || process.cwd();

  // Walk up the directory tree looking for node_modules/.bin
  while (true) {
    const binPath = join(currentDir, "node_modules", ".bin", executableName);

    if (existsSync(binPath)) {
      return binPath;
    }

    const parentDir = join(currentDir, "..");
    if (parentDir === currentDir) {
      // Reached the root directory
      break;
    }
    currentDir = parentDir;
  }

  // Also check global node_modules (though this is less common for these tools)
  const globalPrefixes = isWindows
    ? [process.env.APPDATA ? join(process.env.APPDATA, "npm") : null]
    : ["/usr/local", "/usr"];

  for (const prefix of globalPrefixes) {
    if (prefix) {
      const globalBinPath = join(
        prefix,
        "lib",
        "node_modules",
        ".bin",
        executableName,
      );
      if (existsSync(globalBinPath)) {
        return globalBinPath;
      }
    }
  }

  return null;
}

/**
 * Get the command and args for a node_modules binary
 * Falls back to npx if the binary is not found locally
 *
 * @param binName - The name of the binary
 * @param args - Additional arguments for the binary
 * @param projectRoot - Optional project root to search from
 * @returns Object with command and args
 */
export function getNodeModulesCommand(
  binName: string,
  args: string[] = [],
  projectRoot?: string,
): { command: string; args: string[] } {
  const binPath = getNodeModulesBin(binName, projectRoot);

  if (binPath) {
    return {
      command: binPath,
      args,
    };
  }

  // Check if the binary is available globally in PATH
  try {
    const checkCommand = platform() === "win32" ? "where" : "which";
    execSync(`${checkCommand} ${binName}`, { stdio: "ignore" });
    // Binary is available in PATH, use it directly
    return {
      command: binName,
      args,
    };
  } catch {
    // Binary not found in PATH
  }

  // Fall back to npx
  return {
    command: "npx",
    args: [binName, ...args],
  };
}
