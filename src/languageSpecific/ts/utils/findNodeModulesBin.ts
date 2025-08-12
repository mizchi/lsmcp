import { existsSync } from "fs";
import { join, resolve } from "path";

/**
 * Find a binary in node_modules/.bin directory
 * This is more reliable than using npx in test environments
 * @param rootPath The root path to start searching from
 * @param binName The binary name to search for
 * @returns The path to the binary, or null if not found
 */
export function findNodeModulesBin(
  rootPath: string,
  binName: string,
): string | null {
  const isWindows = process.platform === "win32";
  const binFileName = isWindows ? `${binName}.cmd` : binName;

  // Search up to 10 levels up for node_modules
  for (let i = 0; i <= 10; i++) {
    const searchPath =
      i === 0 ? rootPath : resolve(rootPath, ...Array(i).fill(".."));

    const binPath = join(searchPath, "node_modules", ".bin", binFileName);

    if (existsSync(binPath)) {
      return binPath;
    }
  }

  return null;
}
