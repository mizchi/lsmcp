import { existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

/**
 * Find TypeScript Language Server binary in the project
 * @param rootPath The root path of the project
 * @returns The path to the TypeScript Language Server binary, or null if not found
 */
export function findTypescriptLanguageServer(rootPath: string): string | null {
  // Common locations to check for typescript-language-server
  const possiblePaths = [
    // Local node_modules
    join(rootPath, "node_modules", ".bin", "typescript-language-server"),
    join(rootPath, "node_modules", ".bin", "typescript-language-server.cmd"),

    // Parent directories (for monorepos)
    join(rootPath, "..", "node_modules", ".bin", "typescript-language-server"),
    join(
      rootPath,
      "..",
      "..",
      "node_modules",
      ".bin",
      "typescript-language-server",
    ),

    // Global npm/yarn locations (platform specific)
    process.platform === "win32"
      ? join(process.env.APPDATA || "", "npm", "typescript-language-server.cmd")
      : "/usr/local/bin/typescript-language-server",

    // pnpm global
    join(
      process.env.HOME || "",
      ".local",
      "share",
      "pnpm",
      "typescript-language-server",
    ),
  ];

  // Check each path
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  // Check if it's available in PATH
  try {
    if (process.platform === "win32") {
      execSync("where typescript-language-server", { stdio: "pipe" });
    } else {
      execSync("which typescript-language-server", { stdio: "pipe" });
    }
    return "typescript-language-server";
  } catch {
    // Not in PATH
  }

  return null;
}
