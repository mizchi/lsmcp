/**
 * Git utilities for incremental indexing
 * Now uses async spawn instead of execSync to avoid blocking and memory issues
 */

import { spawn } from "child_process";
import { existsSync } from "fs";
import { join, relative } from "path";
import { Result, ok, err } from "neverthrow";

// Error types
export type GitError =
  | { type: "NOT_GIT_REPO"; message: string }
  | { type: "INVALID_HASH"; message: string }
  | { type: "HASH_NOT_FOUND"; message: string; hash: string }
  | { type: "COMMAND_FAILED"; message: string; command: string }
  | { type: "TIMEOUT"; message: string; timeout: number };

/**
 * Execute git command asynchronously with streaming output
 */
async function executeGitCommand(
  command: string,
  args: string[],
  cwd: string,
  options?: {
    timeout?: number;
    maxOutputSize?: number;
  },
): Promise<string> {
  const timeout = options?.timeout ?? 30000;
  const maxOutputSize = options?.maxOutputSize ?? 200 * 1024 * 1024; // 200MB default

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let outputSize = 0;
    let timedOut = false;

    // Set timeout
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    // Handle stdout
    proc.stdout.on("data", (chunk) => {
      const chunkStr = chunk.toString();
      outputSize += chunkStr.length;

      if (outputSize > maxOutputSize) {
        proc.kill("SIGTERM");
        clearTimeout(timer);
        reject(new Error(`Output exceeded max size of ${maxOutputSize} bytes`));
        return;
      }

      stdout += chunkStr;
    });

    // Handle stderr
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    // Handle process exit
    proc.on("close", (code) => {
      clearTimeout(timer);

      if (timedOut) return; // Already rejected due to timeout

      if (code === 0) {
        resolve(stdout);
      } else {
        const errorMsg = stderr || `Command failed with code ${code}`;
        reject(new Error(errorMsg));
      }
    });

    // Handle process errors
    proc.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

/**
 * Get current git commit hash (async)
 */
export async function getGitHashAsync(
  rootPath: string,
): Promise<Result<string, GitError>> {
  if (!existsSync(join(rootPath, ".git"))) {
    return err({
      type: "NOT_GIT_REPO",
      message: `Not a git repository: ${rootPath}`,
    });
  }

  try {
    const output = await executeGitCommand(
      "git",
      ["rev-parse", "HEAD"],
      rootPath,
    );
    return ok(output.trim());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[gitUtils] getGitHash error: ${message}`);

    if (message.includes("timed out")) {
      return err({
        type: "TIMEOUT",
        message: `Git command timed out`,
        timeout: 30000,
      });
    }

    return err({
      type: "COMMAND_FAILED",
      message,
      command: "git rev-parse HEAD",
    });
  }
}

/**
 * Check if a hash exists in the repository
 */
async function checkHashExists(
  rootPath: string,
  hash: string,
): Promise<boolean> {
  try {
    await executeGitCommand(
      "git",
      ["cat-file", "-e", `${hash}^{commit}`],
      rootPath,
      { timeout: 5000 },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Get list of modified files since a commit (async)
 */
export async function getModifiedFilesAsync(
  rootPath: string,
  sinceHash: string,
): Promise<Result<string[], GitError>> {
  console.error(
    `[gitUtils] getModifiedFiles called with sinceHash: ${sinceHash}`,
  );

  // Validate hash format
  if (!sinceHash || sinceHash.length < 7) {
    return err({
      type: "INVALID_HASH",
      message: `Invalid hash format: ${sinceHash}`,
    });
  }

  // Check if the hash exists
  const hashExists = await checkHashExists(rootPath, sinceHash);
  if (!hashExists) {
    console.error(`[gitUtils] Hash ${sinceHash} not found in repository`);
    return err({
      type: "HASH_NOT_FOUND",
      message: `Hash not found in repository`,
      hash: sinceHash,
    });
  }

  try {
    // Get all modified files in parallel
    const [committedChanges, stagedChanges, unstagedChanges] =
      await Promise.all([
        // Files changed between commits
        executeGitCommand(
          "git",
          ["diff", "--name-only", sinceHash, "HEAD"],
          rootPath,
        ),
        // Staged changes
        executeGitCommand("git", ["diff", "--name-only", "--cached"], rootPath),
        // Unstaged changes
        executeGitCommand("git", ["diff", "--name-only"], rootPath),
      ]);

    // Combine all changes and deduplicate
    const allChanges = new Set<string>();

    const addChanges = (output: string) => {
      output
        .split("\n")
        .filter((file) => file.length > 0)
        .map((file) => file.trim())
        .forEach((file) => allChanges.add(file));
    };

    addChanges(committedChanges);
    addChanges(stagedChanges);
    addChanges(unstagedChanges);

    const result = Array.from(allChanges);
    console.error(`[gitUtils] Found ${result.length} modified files`);

    if (result.length > 10000) {
      console.error(
        `[gitUtils] WARNING: Large number of modified files (${result.length}). This may impact performance.`,
      );
    }

    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[gitUtils] getModifiedFiles error: ${message}`);

    if (message.includes("timed out")) {
      return err({
        type: "TIMEOUT",
        message: `Git command timed out`,
        timeout: 30000,
      });
    }

    if (message.includes("exceeded max size")) {
      return err({
        type: "COMMAND_FAILED",
        message: `Buffer overflow: Too many files changed`,
        command: "git diff",
      });
    }

    return err({
      type: "COMMAND_FAILED",
      message,
      command: "git diff",
    });
  }
}

/**
 * Get list of untracked files (async)
 */
export async function getUntrackedFilesAsync(
  rootPath: string,
): Promise<Result<string[], GitError>> {
  try {
    const output = await executeGitCommand(
      "git",
      ["ls-files", "--others", "--exclude-standard"],
      rootPath,
    );

    const files = output
      .split("\n")
      .filter((file) => file.length > 0)
      .map((file) => file.trim());

    console.error(`[gitUtils] Found ${files.length} untracked files`);
    return ok(files);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[gitUtils] getUntrackedFiles error: ${message}`);

    if (message.includes("timed out")) {
      return err({
        type: "TIMEOUT",
        message: `Git command timed out`,
        timeout: 30000,
      });
    }

    return err({
      type: "COMMAND_FAILED",
      message,
      command: "git ls-files --others",
    });
  }
}

/**
 * Get file's last commit hash (async)
 */
export async function getFileGitHash(
  rootPath: string,
  filePath: string,
): Promise<Result<string | null, GitError>> {
  try {
    const relPath = relative(rootPath, filePath);
    const output = await executeGitCommand(
      "git",
      ["log", "-1", "--format=%H", "--", relPath],
      rootPath,
    );

    return ok(output.trim() || null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // If file is not tracked or has no commits, this is not an error
    if (
      message.includes("fatal: your current branch") ||
      message.includes("does not have any commits yet")
    ) {
      return ok(null);
    }

    console.error(`[gitUtils] getFileGitHash error: ${message}`);

    if (message.includes("timed out")) {
      return err({
        type: "TIMEOUT",
        message: `Git command timed out`,
        timeout: 30000,
      });
    }

    return err({
      type: "COMMAND_FAILED",
      message,
      command: "git log",
    });
  }
}
