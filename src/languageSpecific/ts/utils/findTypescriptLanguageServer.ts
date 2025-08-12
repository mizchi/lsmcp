import { existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { findNodeModulesBin } from "./findNodeModulesBin.ts";

/**
 * Find TypeScript Language Server binary in the project
 * @param rootPath The root path of the project
 * @returns The path to the TypeScript Language Server binary, or null if not found
 */
export function findTypescriptLanguageServer(rootPath: string): string | null {
  // First, try to find in node_modules using the dedicated utility
  const nodeModulesBin = findNodeModulesBin(
    rootPath,
    "typescript-language-server",
  );
  if (nodeModulesBin) {
    return nodeModulesBin;
  }

  // Fallback to global locations
  const globalPaths = [
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

  // Check global paths
  for (const path of globalPaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  // Check if it's available in PATH (with timeout to prevent hanging)
  try {
    if (process.platform === "win32") {
      execSync("where typescript-language-server", {
        stdio: "pipe",
        timeout: 1000, // 1 second timeout
      });
    } else {
      execSync("which typescript-language-server", {
        stdio: "pipe",
        timeout: 1000, // 1 second timeout
      });
    }
    return "typescript-language-server";
  } catch {
    // Not in PATH or timed out
  }

  return null;
}
