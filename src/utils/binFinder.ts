/**
 * Binary finder utility for locating LSP server executables
 */

import { existsSync } from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";
import type { BinFindStrategy } from "../config/schema.ts";
import { mcpDebugWithPrefix } from "./mcp-logger.ts";

/**
 * Find a binary using the specified strategy
 *
 * @param strategy The binary find strategy
 * @param projectRoot The project root directory
 * @returns The resolved command and args, or null if not found
 */
export function findBinary(
  strategy: BinFindStrategy,
  projectRoot: string = process.cwd(),
): { command: string; args: string[] } | null {
  mcpDebugWithPrefix(
    "BinFinder",
    `Searching for binary with strategy:`,
    strategy,
  );

  // Try each search path in order
  for (const searchPath of strategy.searchPaths) {
    // 1. Check node_modules/.bin in current directory
    const localBin = join(projectRoot, "node_modules", ".bin", searchPath);
    if (existsSync(localBin)) {
      mcpDebugWithPrefix(
        "BinFinder",
        `Found in local node_modules: ${localBin}`,
      );
      return { command: localBin, args: [] };
    }

    // 2. Search parent directories for node_modules/.bin
    let currentDir = projectRoot;
    let parentDir = dirname(currentDir);
    while (parentDir !== currentDir) {
      const parentBin = join(parentDir, "node_modules", ".bin", searchPath);
      if (existsSync(parentBin)) {
        mcpDebugWithPrefix(
          "BinFinder",
          `Found in parent node_modules: ${parentBin}`,
        );
        return { command: parentBin, args: [] };
      }
      currentDir = parentDir;
      parentDir = dirname(currentDir);
    }

    // 3. Check if it's available globally
    try {
      const globalPath = execSync(`which ${searchPath}`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"], // Suppress stderr
      }).trim();
      if (globalPath) {
        mcpDebugWithPrefix("BinFinder", `Found globally: ${globalPath}`);
        return { command: globalPath, args: [] };
      }
    } catch {
      // Not found globally, continue to next search path
    }
  }

  // 4. Fallback to npx if specified
  if (strategy.npxPackage) {
    mcpDebugWithPrefix(
      "BinFinder",
      `Falling back to npx: ${strategy.npxPackage}`,
    );
    return {
      command: "npx",
      args: ["-y", strategy.npxPackage],
    };
  }

  mcpDebugWithPrefix("BinFinder", `Binary not found with strategy`);
  return null;
}

/**
 * Resolve the command for an adapter, using binFindStrategy if available
 *
 * @param adapter The adapter configuration
 * @param projectRoot The project root directory
 * @returns The resolved command and args
 */
export function resolveAdapterCommand(
  adapter: {
    bin: string;
    args?: string[];
    binFindStrategy?: BinFindStrategy;
  },
  projectRoot?: string,
): { command: string; args: string[] } {
  // If bin and args are explicitly set, use them directly
  if (adapter.args && adapter.args.length > 0) {
    mcpDebugWithPrefix(
      "BinFinder",
      `Using explicit bin/args: ${adapter.bin} ${adapter.args.join(" ")}`,
    );
    return {
      command: adapter.bin,
      args: adapter.args,
    };
  }

  // If binFindStrategy is available, use it
  if (adapter.binFindStrategy) {
    const found = findBinary(adapter.binFindStrategy, projectRoot);
    if (found) {
      return found;
    }
  }

  // Default: use bin as-is
  mcpDebugWithPrefix("BinFinder", `Using default bin: ${adapter.bin}`);
  return {
    command: adapter.bin,
    args: adapter.args || [],
  };
}
