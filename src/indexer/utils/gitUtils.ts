/**
 * Git utilities for incremental indexing
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join, relative } from "path";

/**
 * Get current git commit hash
 */
export function getGitHash(rootPath: string): string | null {
  try {
    if (!existsSync(join(rootPath, ".git"))) {
      return null;
    }

    const hash = execSync("git rev-parse HEAD", {
      cwd: rootPath,
      encoding: "utf-8",
    }).trim();

    return hash;
  } catch {
    return null;
  }
}

/**
 * Get list of modified files since a commit
 */
export function getModifiedFiles(
  rootPath: string,
  sinceHash: string,
): string[] {
  try {
    // Get files changed between commits
    const committedChanges = execSync(
      `git diff --name-only ${sinceHash} HEAD`,
      {
        cwd: rootPath,
        encoding: "utf-8",
      },
    );

    // Get uncommitted changes (both staged and unstaged)
    const unstagedChanges = execSync("git diff --name-only", {
      cwd: rootPath,
      encoding: "utf-8",
    });

    const stagedChanges = execSync("git diff --name-only --cached", {
      cwd: rootPath,
      encoding: "utf-8",
    });

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
    addChanges(unstagedChanges);
    addChanges(stagedChanges);

    return Array.from(allChanges);
  } catch {
    return [];
  }
}

/**
 * Get list of untracked files
 */
export function getUntrackedFiles(rootPath: string): string[] {
  try {
    const output = execSync("git ls-files --others --exclude-standard", {
      cwd: rootPath,
      encoding: "utf-8",
    });

    return output
      .split("\n")
      .filter((file) => file.length > 0)
      .map((file) => file.trim());
  } catch {
    return [];
  }
}

/**
 * Get file's last commit hash
 */
export function getFileGitHash(
  rootPath: string,
  filePath: string,
): string | null {
  try {
    const relPath = relative(rootPath, filePath);
    const hash = execSync(`git log -1 --format=%H -- "${relPath}"`, {
      cwd: rootPath,
      encoding: "utf-8",
    }).trim();

    return hash || null;
  } catch {
    return null;
  }
}
