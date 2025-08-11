import { dirname, join, relative } from "path";
import ignore, { type Ignore } from "ignore";
import type { FileSystemSync } from "@lsmcp/types/domain";
import * as nodeFs from "fs";

/**
 * GitignoreManager handles .gitignore files in a directory tree
 * It respects .gitignore files in subdirectories as per git's behavior
 */
export class GitignoreManager {
  private ignoreInstances = new Map<string, Ignore>();
  private gitignoreCache = new Map<string, string[]>();

  constructor(
    private rootPath: string,
    private fs: FileSystemSync = nodeFs as FileSystemSync,
  ) {
    this.loadGitignoreHierarchy(rootPath);
  }

  /**
   * Load all .gitignore files from the root path up to the current directory
   */
  private loadGitignoreHierarchy(targetPath: string): void {
    const relativePath = relative(this.rootPath, targetPath);
    const pathSegments = relativePath.split("/").filter(Boolean);

    // Start from root and work down to the target
    let currentPath = this.rootPath;
    this.loadGitignoreFile(currentPath);

    for (const segment of pathSegments) {
      currentPath = join(currentPath, segment);
      this.loadGitignoreFile(currentPath);
    }
  }

  /**
   * Load a single .gitignore file if it exists
   */
  private loadGitignoreFile(dirPath: string): void {
    if (this.ignoreInstances.has(dirPath)) {
      return; // Already loaded
    }

    const gitignorePath = join(dirPath, ".gitignore");
    if (this.fs.existsSync(gitignorePath)) {
      try {
        const content = this.fs.readFileSync(gitignorePath, "utf8");
        const rules = content
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("#"));

        const ig = ignore().add(rules);
        this.ignoreInstances.set(dirPath, ig);
        this.gitignoreCache.set(dirPath, rules);
      } catch (error) {
        // Ignore errors reading .gitignore files
        console.warn(`Failed to read .gitignore at ${gitignorePath}:`, error);
      }
    }
  }

  /**
   * Check if a file should be ignored based on all applicable .gitignore files
   */
  isIgnored(filePath: string, isDirectory: boolean = false): boolean {
    // Always ignore .git directory
    if (
      filePath.includes("/.git/") ||
      filePath.endsWith("/.git") ||
      filePath.startsWith(".git/") ||
      filePath === ".git"
    ) {
      return true;
    }

    const absolutePath = join(this.rootPath, filePath);
    const fileDir = dirname(absolutePath);

    // Ensure we have loaded all gitignore files up to this directory
    this.loadGitignoreHierarchy(fileDir);

    // Check from root to the file's directory
    let currentPath = this.rootPath;
    const relativePath = relative(this.rootPath, absolutePath);
    const pathSegments = relativePath.split("/").filter(Boolean);

    // Check root .gitignore
    const rootIgnore = this.ignoreInstances.get(currentPath);
    if (rootIgnore) {
      // For directories, always check with trailing slash
      // because gitignore patterns like "node_modules/" only match directories
      const pathToCheck = isDirectory ? relativePath + "/" : relativePath;
      if (rootIgnore.ignores(pathToCheck)) {
        return true;
      }
    }

    // Check each subdirectory's .gitignore
    let accumulatedPath = "";
    for (let i = 0; i < pathSegments.length - 1; i++) {
      currentPath = join(currentPath, pathSegments[i]);
      accumulatedPath = accumulatedPath
        ? join(accumulatedPath, pathSegments[i])
        : pathSegments[i];

      const ig = this.ignoreInstances.get(currentPath);
      if (ig) {
        // Calculate relative path from this .gitignore's directory
        const remainingPath = pathSegments.slice(i + 1).join("/");
        // For directories at the end of the path, check with trailing slash
        const isLastSegmentDirectory =
          isDirectory && i === pathSegments.length - 2;
        const pathToCheck = isLastSegmentDirectory
          ? remainingPath + "/"
          : remainingPath;
        if (ig.ignores(pathToCheck)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get all loaded gitignore rules for debugging
   */
  getLoadedRules(): Map<string, string[]> {
    return new Map(this.gitignoreCache);
  }
}

/**
 * Create a gitignore filter function
 */
export function createGitignoreFilter(
  rootPath: string,
  fs?: FileSystem,
): (filePath: string, isDirectory?: boolean) => boolean {
  const manager = new GitignoreManager(rootPath, fs);
  return (filePath: string, isDirectory: boolean = false) =>
    !manager.isIgnored(filePath, isDirectory);
}
