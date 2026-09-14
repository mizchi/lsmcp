/**
 * Binary finder utility for locating LSP server executables
 */

import { existsSync } from "fs";
import { join, dirname } from "path";
import {
  type ChildProcess,
  execSync,
  spawn,
  type SpawnOptions,
} from "child_process";
import type { BinFindStrategy, BinFindStrategyItem } from "../config/schema.ts";
import { mcpDebugWithPrefix } from "./mcp-logger.ts";

/** `dir` followed by each of its ancestors up to the filesystem root. */
function* selfAndAncestors(dir: string): Generator<string> {
  let current = dir;
  while (true) {
    yield current;
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

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
export type Found = { command: string; args: string[] };

/**
 * The binaries a strategy proposes, in order, each at most once. Send `true`
 * to next() when the candidate just yielded failed to start: the item's
 * `ifFail` strategies are then tried before the following items.
 */
export function* candidateCommands(
  strategy: BinFindStrategy,
  projectRoot: string = process.cwd(),
  seen: Set<string> = new Set(),
): Generator<Found, void, boolean | undefined> {
  const defaultArgs = strategy.defaultArgs || [];
  for (const item of strategy.strategies) {
    mcpDebugWithPrefix("BinFinder", `Trying strategy: ${item.type}`);
    const found = locate(item, projectRoot, defaultArgs);
    if (!found) {
      continue;
    }
    const key = JSON.stringify([found.command, found.args]);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const failed = yield found;
    if (failed && "ifFail" in item && item.ifFail) {
      yield* candidateCommands(
        { strategies: item.ifFail, defaultArgs },
        projectRoot,
        seen,
      );
    }
  }
}

/** The first candidate of a strategy, or null */
export function findBinary(
  strategy: BinFindStrategy,
  projectRoot: string = process.cwd(),
): Found | null {
  const first = candidateCommands(strategy, projectRoot).next();
  return first.done ? null : first.value;
}

/**
 * Start candidates in order until one succeeds. A candidate whose `start`
 * rejects is reported back to the generator so its fallbacks are tried;
 * when none succeeds the last error is thrown.
 */
export async function startFirstWorking<T>(
  candidates: Iterator<Found, void, boolean | undefined>,
  start: (found: Found) => Promise<T>,
): Promise<T> {
  let failed: boolean | undefined;
  let lastError: unknown = new Error("No LSP server binary specified or found");
  for (let r = candidates.next(failed); !r.done; r = candidates.next(failed)) {
    try {
      const started = await start(r.value);
      candidates.return?.();
      return started;
    } catch (error) {
      mcpDebugWithPrefix(
        "BinFinder",
        `${r.value.command} ${r.value.args.join(" ")} failed to start: ${error instanceof Error ? error.message : String(error)}`,
      );
      lastError = error;
      failed = true;
    }
  }
  throw lastError;
}

function locate(
  item: BinFindStrategyItem,
  projectRoot: string,
  defaultArgs: string[],
): Found | null {
  switch (item.type) {
    case "venv": {
      // Search in Python virtual environments of the project and its ancestors
      const venvDirs = item.venvDirs || [".venv", "venv"];
      for (const name of item.names) {
        for (const dir of selfAndAncestors(projectRoot)) {
          for (const venvDir of venvDirs) {
            const venvBin = join(dir, venvDir, "bin", name);
            if (existsSync(venvBin)) {
              mcpDebugWithPrefix(
                "BinFinder",
                `Found in Python ${venvDir}: ${venvBin}`,
              );
              return { command: venvBin, args: defaultArgs };
            }
          }
        }
      }
      return null;
    }

    case "node_modules": {
      // Names in order; for each, the nearest node_modules/.bin that has it
      const args = item.args ?? defaultArgs;
      for (const name of item.names) {
        for (const dir of selfAndAncestors(projectRoot)) {
          const bin = join(dir, "node_modules", ".bin", name);
          if (existsSync(bin)) {
            mcpDebugWithPrefix("BinFinder", `Found in node_modules: ${bin}`);
            return { command: bin, args };
          }
        }
      }
      return null;
    }

    case "global": {
      // Search globally installed binaries
      const args = item.args ?? defaultArgs;
      for (const name of item.names) {
        try {
          const globalPath = execSync(`which ${name}`, {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "ignore"], // Suppress stderr
          }).trim();
          if (globalPath) {
            mcpDebugWithPrefix("BinFinder", `Found globally: ${globalPath}`);
            return { command: globalPath, args };
          }
        } catch {
          // Not found globally, continue to next name
        }
      }
      return null;
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
      return null;
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
      // Use direct path (expand ~ for home directory)
      const expandedPath = item.path.replace(
        /^~/,
        process.env.HOME || process.env.USERPROFILE || "",
      );
      if (existsSync(expandedPath)) {
        mcpDebugWithPrefix("BinFinder", `Found at path: ${expandedPath}`);
        return { command: expandedPath, args: defaultArgs };
      }
      return null;
    }
  }
}

/**
 * Spawn candidates in order and initialize each with `init`; the first that
 * initializes is returned together with the command that was started.
 */
export function spawnFirstWorking<T>(
  candidates: Iterator<Found, void, boolean | undefined>,
  options: SpawnOptions,
  init: (lspProcess: ChildProcess, found: Found) => Promise<T>,
): Promise<{ found: Found; lspProcess: ChildProcess; lspClient: T }> {
  return startFirstWorking(candidates, async (found) => {
    const lspProcess = spawn(found.command, found.args, options);
    const lspClient = await init(lspProcess, found);
    return { found, lspProcess, lspClient };
  });
}

type AdapterBin = {
  bin?: string;
  args?: string[];
  binFindStrategy?: BinFindStrategy;
};

/** Every binary an adapter may run, in the order resolveAdapterCommand would pick them */
export function* adapterCandidates(
  adapter: AdapterBin,
  projectRoot?: string,
): Generator<Found, void, boolean | undefined> {
  if (adapter.bin && adapter.args && adapter.args.length > 0) {
    yield { command: adapter.bin, args: adapter.args };
    return;
  }
  if (adapter.binFindStrategy) {
    yield* candidateCommands(adapter.binFindStrategy, projectRoot);
  }
  if (adapter.bin) {
    yield { command: adapter.bin, args: adapter.args || [] };
  }
}

/**
 * Resolve the command for an adapter, using binFindStrategy if available
 *
 * @param adapter The adapter configuration
 * @param projectRoot The project root directory
 * @returns The resolved command and args
 */
export function resolveAdapterCommand(
  adapter: AdapterBin,
  projectRoot?: string,
): Found {
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
