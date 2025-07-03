import { beforeEach, describe, expect, it } from "vitest";
import { createFsFromVolume, Volume } from "memfs";
import { createGitignoreFilter, GitignoreManager } from "./gitignoreUtils.ts";
import type { FileSystem } from "./fs-interface.ts";

describe("GitignoreManager", () => {
  let vol: Volume;
  let fs: FileSystem;

  beforeEach(() => {
    vol = Volume.fromJSON({
      "/project/.gitignore": `
# Dependencies
node_modules/
*.log

# Build outputs
dist/
build/
*.min.js

# IDE
.vscode/
.idea/
`,
      "/project/src/.gitignore": `
# Test files
*.test.ts
*.spec.ts
temp/
`,
      "/project/src/feature/.gitignore": `
# Local only
local.ts
*.local.*
`,
      "/project/README.md": "# Project",
      "/project/package.json": "{}",
      "/project/node_modules/lib/index.js": "module.exports = {}",
      "/project/src/index.ts": "console.log('hello')",
      "/project/src/index.test.ts": "test('hello', () => {})",
      "/project/src/utils.ts": "export function util() {}",
      "/project/src/feature/main.ts": "export function main() {}",
      "/project/src/feature/local.ts": "// local only",
      "/project/src/feature/config.local.json": "{}",
      "/project/dist/bundle.js": "// bundled",
      "/project/error.log": "Error logs",
      "/project/.vscode/settings.json": "{}",
    });
    fs = createFsFromVolume(vol) as FileSystem;
  });

  it("should respect root .gitignore patterns", () => {
    const manager = new GitignoreManager("/project", fs);

    // Should ignore node_modules
    expect(manager.isIgnored("node_modules/lib/index.js")).toBe(true);

    // Should ignore log files
    expect(manager.isIgnored("error.log")).toBe(true);

    // Should ignore dist directory
    expect(manager.isIgnored("dist/bundle.js")).toBe(true);

    // Should ignore IDE directories
    expect(manager.isIgnored(".vscode/settings.json")).toBe(true);

    // Should not ignore regular files
    expect(manager.isIgnored("README.md")).toBe(false);
    expect(manager.isIgnored("package.json")).toBe(false);
    expect(manager.isIgnored("src/index.ts")).toBe(false);
  });

  it("should respect subdirectory .gitignore patterns", () => {
    const manager = new GitignoreManager("/project", fs);

    // Should respect src/.gitignore
    expect(manager.isIgnored("src/index.test.ts")).toBe(true);
    expect(manager.isIgnored("src/utils.spec.ts")).toBe(true);
    expect(manager.isIgnored("src/temp/file.ts")).toBe(true);

    // Should not ignore non-test files
    expect(manager.isIgnored("src/index.ts")).toBe(false);
    expect(manager.isIgnored("src/utils.ts")).toBe(false);
  });

  it("should respect deeply nested .gitignore patterns", () => {
    const manager = new GitignoreManager("/project", fs);

    // Should respect src/feature/.gitignore
    expect(manager.isIgnored("src/feature/local.ts")).toBe(true);
    expect(manager.isIgnored("src/feature/config.local.json")).toBe(true);

    // Should not ignore other files in the same directory
    expect(manager.isIgnored("src/feature/main.ts")).toBe(false);
  });

  it("should always ignore .git directory", () => {
    const manager = new GitignoreManager("/project", fs);

    expect(manager.isIgnored(".git/config")).toBe(true);
    expect(manager.isIgnored(".git/hooks/pre-commit")).toBe(true);
    expect(manager.isIgnored("src/.git/config")).toBe(true);
  });

  it("should handle patterns correctly from different directory levels", () => {
    const manager = new GitignoreManager("/project", fs);

    // Pattern from root should apply to all subdirectories
    expect(manager.isIgnored("src/node_modules/package.json")).toBe(true);
    expect(manager.isIgnored("src/feature/node_modules/lib.js")).toBe(true);

    // Pattern from subdirectory should only apply within that directory
    expect(manager.isIgnored("index.test.ts")).toBe(false); // Not in src/
    expect(manager.isIgnored("feature/main.test.ts")).toBe(false); // Not in src/
  });
});

describe("createGitignoreFilter", () => {
  let vol: Volume;
  let fs: FileSystem;

  beforeEach(() => {
    vol = Volume.fromJSON({
      "/project/.gitignore": `
node_modules/
dist/
*.test.ts
`,
      "/project/src/index.ts": "console.log('hello')",
      "/project/README.md": "# Project",
      "/project/node_modules/lib/index.js": "module.exports = {}",
      "/project/dist/bundle.js": "// bundled",
      "/project/src/index.test.ts": "test('hello', () => {})",
    });
    fs = createFsFromVolume(vol) as FileSystem;
  });

  it("should create a filter function that returns false for ignored files", () => {
    const filter = createGitignoreFilter("/project", fs);

    // Filter returns true for files that should be included
    expect(filter("src/index.ts")).toBe(true);
    expect(filter("README.md")).toBe(true);

    // Filter returns false for files that should be ignored
    expect(filter("node_modules/lib/index.js")).toBe(false);
    expect(filter("dist/bundle.js")).toBe(false);
    expect(filter("src/index.test.ts")).toBe(false);
  });
});
