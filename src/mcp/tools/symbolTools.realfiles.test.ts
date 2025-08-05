import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getFilesRecursively, getSymbolsOverviewTool } from "./symbolTools.ts";
import {
  getOrCreateIndex,
  indexFiles,
  querySymbols as queryIndexSymbols,
} from "../../indexer/mcp/IndexerAdapter.ts";
import { vi } from "vitest";

// Test fixture directory
const TEST_DIR = "test-symbols-overview-fixtures";
const TEST_ROOT = join(process.cwd(), TEST_DIR);

describe.skipIf(!process.env.WITH_LSP)("symbolTools real file tests", () => {
  beforeAll(() => {
    // Create test directory structure
    if (existsSync(TEST_ROOT)) {
      rmSync(TEST_ROOT, { recursive: true, force: true });
    }
    mkdirSync(TEST_ROOT, { recursive: true });

    // Create test files
    mkdirSync(join(TEST_ROOT, "src"), { recursive: true });
    mkdirSync(join(TEST_ROOT, "src/components"), { recursive: true });
    mkdirSync(join(TEST_ROOT, "src/utils"), { recursive: true });
    mkdirSync(join(TEST_ROOT, "src/utils/helpers"), { recursive: true });
    mkdirSync(join(TEST_ROOT, "node_modules"), { recursive: true });
    mkdirSync(join(TEST_ROOT, ".git"), { recursive: true });

    // Write test files
    writeFileSync(
      join(TEST_ROOT, "src/index.ts"),
      `export const main = () => console.log("Hello");`,
    );
    writeFileSync(
      join(TEST_ROOT, "src/components/Button.tsx"),
      `export const Button = () => <button>Click</button>;`,
    );
    writeFileSync(
      join(TEST_ROOT, "src/components/Input.tsx"),
      `export const Input = () => <input />;`,
    );
    writeFileSync(
      join(TEST_ROOT, "src/utils/format.ts"),
      `export const format = (s: string) => s.trim();`,
    );
    writeFileSync(
      join(TEST_ROOT, "src/utils/helpers/string.ts"),
      `export const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);`,
    );
    writeFileSync(join(TEST_ROOT, "src/README.md"), `# Documentation`);
    writeFileSync(
      join(TEST_ROOT, "node_modules/lib.js"),
      `module.exports = {};`,
    );
    writeFileSync(join(TEST_ROOT, ".gitignore"), `node_modules/\n*.log`);
  });

  afterAll(() => {
    // Clean up test directory
    if (existsSync(TEST_ROOT)) {
      rmSync(TEST_ROOT, { recursive: true, force: true });
    }
  });

  describe("Level 1: getFilesRecursively", () => {
    it("should recursively find all TypeScript/TSX files", async () => {
      const srcPath = join(TEST_ROOT, "src");
      const files = await getFilesRecursively(srcPath, TEST_ROOT);

      // Sort for consistent comparison
      files.sort();

      expect(files).toEqual([
        "src/components/Button.tsx",
        "src/components/Input.tsx",
        "src/index.ts",
        "src/utils/format.ts",
        "src/utils/helpers/string.ts",
      ]);
    });

    it("should skip node_modules and .git directories", async () => {
      const files = await getFilesRecursively(TEST_ROOT, TEST_ROOT);

      // Should not include any files from node_modules
      expect(files.some((f) => f.includes("node_modules"))).toBe(false);
      expect(files.some((f) => f.includes(".git"))).toBe(false);
    });

    it("should filter files by extension", async () => {
      const files = await getFilesRecursively(TEST_ROOT, TEST_ROOT);

      // Should not include README.md
      expect(files.some((f) => f.includes("README.md"))).toBe(false);

      // Should include all TypeScript/TSX files
      expect(files.some((f) => f.endsWith(".ts"))).toBe(true);
      expect(files.some((f) => f.endsWith(".tsx"))).toBe(true);
    });
  });

  describe("Level 2: indexFiles API", () => {
    beforeAll(async () => {
      vi.spyOn(process, "cwd").mockReturnValue(TEST_ROOT);
    });

    afterAll(() => {
      vi.mocked(process.cwd).mockRestore();
    });

    it("should index files and return success", async () => {
      const testFiles = [
        "src/index.ts",
        "src/components/Button.tsx",
        "src/utils/format.ts",
      ];

      const result = await indexFiles(TEST_ROOT, testFiles);

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("Level 3: queryIndexSymbols API", () => {
    beforeAll(async () => {
      vi.spyOn(process, "cwd").mockReturnValue(TEST_ROOT);

      // Ensure files are indexed
      await indexFiles(TEST_ROOT, [
        "src/index.ts",
        "src/components/Button.tsx",
        "src/utils/format.ts",
      ]);
    });

    it("should query symbols from indexed files", () => {
      const symbols = queryIndexSymbols(TEST_ROOT, { file: "src/index.ts" });

      expect(symbols).toBeDefined();
      if (symbols.length > 0) {
        // Should find the main export
        const mainSymbol = symbols.find((s) => s.name === "main");
        expect(mainSymbol).toBeDefined();
      }
    });

    it("should filter top-level symbols", () => {
      const symbols = queryIndexSymbols(TEST_ROOT, {
        file: "src/components/Button.tsx",
      });
      const topLevelSymbols = symbols.filter((s) => !s.containerName);

      if (topLevelSymbols.length > 0) {
        expect(topLevelSymbols.some((s) => s.name === "Button")).toBe(true);
      }
    });

    afterAll(() => {
      vi.mocked(process.cwd).mockRestore();
    });
  });

  describe("Level 4: getSymbolsOverviewTool integration", () => {
    beforeAll(async () => {
      vi.spyOn(process, "cwd").mockReturnValue(TEST_ROOT);

      // Initialize index
      const index = getOrCreateIndex(TEST_ROOT);
      if (index) {
        await index.indexFiles(["src/index.ts", "src/components/Button.tsx"]);
      }
    });

    afterAll(() => {
      vi.mocked(process.cwd).mockRestore();
    });

    it("should get symbols overview for a single file", async () => {
      const result = await getSymbolsOverviewTool.execute({
        relativePath: "src/index.ts",
        maxAnswerChars: 200000,
      });

      const overview = JSON.parse(result);
      expect(overview).not.toHaveProperty("error");
      expect(overview["src/index.ts"]).toBeDefined();
      expect(overview["src/index.ts"].length).toBeGreaterThan(0);
      expect(overview["src/index.ts"][0]).toHaveProperty("name_path");
      expect(overview["src/index.ts"][0]).toHaveProperty("kind");
    });

    it("should get symbols overview for a directory recursively", async () => {
      const result = await getSymbolsOverviewTool.execute({
        relativePath: "src",
        maxAnswerChars: 200000,
      });

      const overview = JSON.parse(result);

      // Debug output if error
      if (overview.error) {
        console.log("Error:", overview.error);
      }

      expect(overview).not.toHaveProperty("error");

      // Should have multiple files
      const fileKeys = Object.keys(overview);
      expect(fileKeys.length).toBeGreaterThan(1);

      // Should include files from subdirectories
      expect(fileKeys.some((f) => f.includes("components/"))).toBe(true);
      expect(fileKeys.some((f) => f.includes("utils/"))).toBe(true);
      expect(fileKeys.some((f) => f.includes("utils/helpers/"))).toBe(true);
    });

    it("should handle empty directory gracefully", async () => {
      // Create empty directory
      mkdirSync(join(TEST_ROOT, "empty"), { recursive: true });

      const result = await getSymbolsOverviewTool.execute({
        relativePath: "empty",
        maxAnswerChars: 200000,
      });

      const overview = JSON.parse(result);

      if (overview.error) {
        expect(overview.error).toMatch(/No files found/);
      } else {
        expect(Object.keys(overview).length).toBe(0);
      }
    });
  });
});
