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
 * Strategies are tried in the order specified in the configuration.
 * Each strategy type has its own search logic.
 *
 * @param strategy The binary find strategy configuration
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

  const defaultArgs = strategy.defaultArgs || [];

  // Try each strategy in order
  for (const item of strategy.strategies) {
    mcpDebugWithPrefix("BinFinder", `Trying strategy: ${item.type}`);

    switch (item.type) {
      case "venv": {
        // Search in Python virtual environments
        const venvDirs = item.venvDirs || [".venv", "venv"];
        for (const name of item.names) {
          // Check current directory
          for (const venvDir of venvDirs) {
            const venvBin = join(projectRoot, venvDir, "bin", name);
            if (existsSync(venvBin)) {
              mcpDebugWithPrefix(
                "BinFinder",
                `Found in Python ${venvDir}: ${venvBin}`,
              );
              return { command: venvBin, args: defaultArgs };
            }
          }

          // Check parent directories
          let currentDir = projectRoot;
          let parentDir = dirname(currentDir);
          while (parentDir !== currentDir) {
            for (const venvDir of venvDirs) {
              const parentVenvBin = join(parentDir, venvDir, "bin", name);
              if (existsSync(parentVenvBin)) {
                mcpDebugWithPrefix(
                  "BinFinder",
                  `Found in parent ${venvDir}: ${parentVenvBin}`,
                );
                return { command: parentVenvBin, args: defaultArgs };
              }
            }
            currentDir = parentDir;
            parentDir = dirname(currentDir);
          }
        }
        break;
      }

      case "node_modules": {
        // Search in node_modules/.bin
        for (const name of item.names) {
          // Check current directory
          const localBin = join(projectRoot, "node_modules", ".bin", name);
          if (existsSync(localBin)) {
            mcpDebugWithPrefix(
              "BinFinder",
              `Found in local node_modules: ${localBin}`,
            );
            return { command: localBin, args: defaultArgs };
          }

          // Check parent directories
          let currentDir = projectRoot;
          let parentDir = dirname(currentDir);
          while (parentDir !== currentDir) {
            const parentBin = join(parentDir, "node_modules", ".bin", name);
            if (existsSync(parentBin)) {
              mcpDebugWithPrefix(
                "BinFinder",
                `Found in parent node_modules: ${parentBin}`,
              );
              return { command: parentBin, args: defaultArgs };
            }
            currentDir = parentDir;
            parentDir = dirname(currentDir);
          }
        }
        break;
      }

      case "global": {
        // Search globally installed binaries
        for (const name of item.names) {
          try {
            const globalPath = execSync(`which ${name}`, {
              encoding: "utf-8",
              stdio: ["pipe", "pipe", "ignore"], // Suppress stderr
            }).trim();
            if (globalPath) {
              mcpDebugWithPrefix("BinFinder", `Found globally: ${globalPath}`);
              return { command: globalPath, args: defaultArgs };
            }
          } catch {
            // Not found globally, continue to next name
          }
        }
        break;
      }

      case "uv": {
        // Use UV run for Python packages
        try {
          execSync("which uv", {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "ignore"],
          });

          // Check if uv.lock exists in the project (indicates uv sync has been run)
          const uvLockPath = join(projectRoot, "uv.lock");
          const pyprojectPath = join(projectRoot, "pyproject.toml");

          if (existsSync(uvLockPath) || existsSync(pyprojectPath)) {
            // Project uses uv, use uv run
            mcpDebugWithPrefix(
              "BinFinder",
              `Using uv run: ${item.command || item.tool}`,
            );

            if (item.command) {
              // Use specific command from the tool
              return {
                command: "uv",
                args: ["run", item.command, ...defaultArgs],
              };
            } else {
              // Use tool directly
              return {
                command: "uv",
                args: ["run", item.tool, ...defaultArgs],
              };
            }
          } else {
            // No uv.lock, try uv tool run instead
            mcpDebugWithPrefix("BinFinder", `Using uv tool run: ${item.tool}`);

            if (item.command) {
              // Use specific command from the tool
              return {
                command: "uv",
                args: [
                  "tool",
                  "run",
                  "--from",
                  item.tool,
                  item.command,
                  ...defaultArgs,
                ],
              };
            } else {
              // Use tool directly
              return {
                command: "uv",
                args: ["tool", "run", item.tool, ...defaultArgs],
              };
            }
          }
        } catch {
          mcpDebugWithPrefix("BinFinder", `uv not found, skipping uv strategy`);
        }
        break;
      }

      case "npx": {
        // Use NPX to run package
        mcpDebugWithPrefix("BinFinder", `Using npx: ${item.package}`);
        return {
          command: "npx",
          args: ["-y", item.package, ...defaultArgs],
        };
      }

      case "path": {
        // Use direct path
        if (existsSync(item.path)) {
          mcpDebugWithPrefix("BinFinder", `Found at path: ${item.path}`);
          return { command: item.path, args: defaultArgs };
        }
        break;
      }
    }
  }

  mcpDebugWithPrefix("BinFinder", `Binary not found with any strategy`);
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
    bin?: string;
    args?: string[];
    binFindStrategy?: BinFindStrategy;
  },
  projectRoot?: string,
): { command: string; args: string[] } {
  // If bin and args are explicitly set, use them directly
  if (adapter.bin && adapter.args && adapter.args.length > 0) {
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

  // Default: use bin as-is if available
  if (adapter.bin) {
    mcpDebugWithPrefix("BinFinder", `Using default bin: ${adapter.bin}`);
    return {
      command: adapter.bin,
      args: adapter.args || [],
    };
  }

  // No binary found
  throw new Error("No LSP server binary specified or found");
}
