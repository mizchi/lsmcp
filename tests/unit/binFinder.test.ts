import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  findBinary,
  resolveAdapterCommand,
} from "../../src/utils/binFinder.ts";
import type { BinFindStrategy } from "../../src/config/schema.ts";
import * as fs from "fs";
import * as child_process from "child_process";
import { join } from "path";

// Mock modules
vi.mock("fs");
vi.mock("child_process");

describe("binFinder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default mock behavior
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("findBinary", () => {
    it("should find binary in local node_modules/.bin", () => {
      const strategy: BinFindStrategy = {
        strategies: [{ type: "node_modules", names: ["tsgo"] }],
        defaultArgs: ["--lsp", "--stdio"],
      };

      const projectRoot = "/test/project";
      const expectedPath = join(projectRoot, "node_modules", ".bin", "tsgo");

      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === expectedPath;
      });

      const result = findBinary(strategy, projectRoot);

      expect(result).toEqual({
        command: expectedPath,
        args: ["--lsp", "--stdio"],
      });
    });

    it("should find binary in parent node_modules/.bin", () => {
      const strategy: BinFindStrategy = {
        strategies: [
          { type: "node_modules", names: ["typescript-language-server"] },
        ],
        defaultArgs: ["--stdio"],
      };

      const projectRoot = "/test/deep/nested/project";
      const parentPath =
        "/test/deep/node_modules/.bin/typescript-language-server";

      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === parentPath;
      });

      const result = findBinary(strategy, projectRoot);

      expect(result).toEqual({
        command: parentPath,
        args: ["--stdio"],
      });
    });

    it("should find globally installed binary", () => {
      const strategy: BinFindStrategy = {
        strategies: [{ type: "global", names: ["tsgo"] }],
        defaultArgs: ["--lsp"],
      };

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(child_process.execSync).mockImplementation((cmd, options) => {
        if ((cmd as string).includes("which tsgo")) {
          // When encoding is specified, return a string
          if (options && (options as any).encoding === "utf-8") {
            return "/usr/local/bin/tsgo\n";
          }
          return Buffer.from("/usr/local/bin/tsgo\n");
        }
        throw new Error("Command not found");
      });

      const result = findBinary(strategy, "/test/project");

      expect(result).toEqual({
        command: "/usr/local/bin/tsgo",
        args: ["--lsp"],
      });
    });

    it("should fallback to npx when binary not found", () => {
      const strategy: BinFindStrategy = {
        strategies: [
          { type: "node_modules", names: ["tsgo"] },
          { type: "npx", package: "@typescript/native-preview" },
        ],
        defaultArgs: ["--lsp", "--stdio"],
      };

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error("Command not found");
      });

      const result = findBinary(strategy, "/test/project");

      expect(result).toEqual({
        command: "npx",
        args: ["-y", "@typescript/native-preview", "--lsp", "--stdio"],
      });
    });

    it("should return null when no binary found and no npx fallback", () => {
      const strategy: BinFindStrategy = {
        strategies: [{ type: "node_modules", names: ["nonexistent"] }],
        defaultArgs: [],
      };

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error("Command not found");
      });

      const result = findBinary(strategy, "/test/project");

      expect(result).toBeNull();
    });

    it("should try multiple search paths", () => {
      const strategy: BinFindStrategy = {
        strategies: [
          {
            type: "node_modules",
            names: ["nonexistent1", "nonexistent2", "tsgo"],
          },
        ],
        defaultArgs: ["--stdio"],
      };

      const projectRoot = "/test/project";
      const expectedPath = join(projectRoot, "node_modules", ".bin", "tsgo");

      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === expectedPath;
      });

      // Mock execSync to throw for all which commands
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error("Command not found");
      });

      const result = findBinary(strategy, projectRoot);

      expect(result).toEqual({
        command: expectedPath,
        args: ["--stdio"],
      });

      // Check that we tried to find tsgo in local node_modules
      expect(fs.existsSync).toHaveBeenCalledWith(expectedPath);
    });
  });

  describe("resolveAdapterCommand", () => {
    it("should use explicit bin and args when provided", () => {
      const adapter = {
        bin: "/usr/bin/custom-lsp",
        args: ["--custom", "--flags"],
      };

      const result = resolveAdapterCommand(adapter);

      expect(result).toEqual({
        command: "/usr/bin/custom-lsp",
        args: ["--custom", "--flags"],
      });
    });

    it("should use binFindStrategy when bin not provided", () => {
      const adapter = {
        binFindStrategy: {
          strategies: [
            { type: "node_modules" as const, names: ["tsgo"] },
            { type: "npx" as const, package: "@typescript/native-preview" },
          ],
          defaultArgs: ["--lsp", "--stdio"],
        },
      };

      const projectRoot = "/test/project";
      const expectedPath = join(projectRoot, "node_modules", ".bin", "tsgo");

      vi.mocked(fs.existsSync).mockImplementation((path) => {
        return path === expectedPath;
      });

      const result = resolveAdapterCommand(adapter, projectRoot);

      expect(result).toEqual({
        command: expectedPath,
        args: ["--lsp", "--stdio"],
      });
    });

    it("should prefer explicit bin/args over binFindStrategy", () => {
      const adapter = {
        bin: "/explicit/path",
        args: ["--explicit"],
        binFindStrategy: {
          strategies: [{ type: "node_modules" as const, names: ["tsgo"] }],
          defaultArgs: ["--lsp"],
        },
      };

      const result = resolveAdapterCommand(adapter);

      expect(result).toEqual({
        command: "/explicit/path",
        args: ["--explicit"],
      });

      // Should not call existsSync since we're using explicit bin/args
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it("should use bin as-is when no args or strategy provided", () => {
      const adapter = {
        bin: "simple-lsp",
      };

      const result = resolveAdapterCommand(adapter);

      expect(result).toEqual({
        command: "simple-lsp",
        args: [],
      });
    });

    it("should throw error when no binary specified or found", () => {
      const adapter = {
        binFindStrategy: {
          strategies: [{ type: "node_modules" as const, names: ["nonexistent"] }],
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(child_process.execSync).mockImplementation(() => {
        throw new Error("Command not found");
      });

      expect(() => resolveAdapterCommand(adapter)).toThrow(
        "No LSP server binary specified or found",
      );
    });

    it("should use default args from strategy when using binFindStrategy", () => {
      const adapter = {
        binFindStrategy: {
          strategies: [{ type: "global" as const, names: ["lsp-server"] }],
          defaultArgs: ["--arg1", "--arg2"],
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(child_process.execSync).mockImplementation((cmd, options) => {
        if ((cmd as string).includes("which lsp-server")) {
          // When encoding is specified, return a string
          if (options && (options as any).encoding === "utf-8") {
            return "/usr/bin/lsp-server\n";
          }
          return Buffer.from("/usr/bin/lsp-server\n");
        }
        throw new Error("Command not found");
      });

      const result = resolveAdapterCommand(adapter);

      expect(result).toEqual({
        command: "/usr/bin/lsp-server",
        args: ["--arg1", "--arg2"],
      });
    });
  });
});
