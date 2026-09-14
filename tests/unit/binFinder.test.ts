import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  candidateCommands,
  findBinary,
  resolveAdapterCommand,
  startFirstWorking,
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
    it("should find binary in local node_modules/.bin", async () => {
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

    it("should find binary in parent node_modules/.bin", async () => {
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

    describe("ifFail, driven by start failures (typescript preset shape)", () => {
      const tls = {
        type: "node_modules" as const,
        names: ["typescript-language-server"],
      };
      const globalTls = {
        type: "global" as const,
        names: ["typescript-language-server"],
      };
      const npxTls = {
        type: "npx" as const,
        package: "typescript-language-server",
      };
      const strategy: BinFindStrategy = {
        strategies: [
          {
            type: "node_modules",
            names: ["tsc"],
            args: ["--lsp", "--stdio"],
            ifFail: [tls, globalTls, npxTls],
          },
          {
            type: "global",
            names: ["tsc"],
            args: ["--lsp", "--stdio"],
            ifFail: [tls, globalTls, npxTls],
          },
          tls,
          globalTls,
          npxTls,
        ],
        defaultArgs: ["--stdio"],
      };
      const projectRoot = "/test/project";
      const local = {
        tsc: join(projectRoot, "node_modules", ".bin", "tsc"),
        tls: join(
          projectRoot,
          "node_modules",
          ".bin",
          "typescript-language-server",
        ),
      };
      const parentTsc = "/test/node_modules/.bin/tsc";
      const globalBins: Record<string, string> = {
        tsc: "/usr/local/bin/tsc",
        "typescript-language-server":
          "/usr/local/bin/typescript-language-server",
      };

      /** files that exist and which global binaries `which` finds */
      function layout(existing: string[], global: string[]) {
        vi.mocked(fs.existsSync).mockImplementation((path) =>
          existing.includes(String(path)),
        );
        vi.mocked(child_process.execSync).mockImplementation((cmd) => {
          const name = String(cmd).replace("which ", "");
          if (global.includes(name)) return globalBins[name] + "\n";
          throw new Error("not found");
        });
      }

      /** start candidates in order; commands in `failing` reject */
      async function startWith(failing: string[]) {
        const attempted: string[] = [];
        const started = await startFirstWorking(
          candidateCommands(strategy, projectRoot),
          async (found) => {
            attempted.push(found.command);
            if (failing.includes(found.command)) {
              throw new Error(`${found.command} exited with code 1`);
            }
            return found;
          },
        );
        return { started, attempted };
      }

      it("uses the local tsc when it starts", async () => {
        layout([local.tsc, local.tls], []);

        const { started, attempted } = await startWith([]);
        expect(started).toEqual({
          command: local.tsc,
          args: ["--lsp", "--stdio"],
        });
        expect(attempted).toEqual([local.tsc]);
      });

      it("falls back to the local language server when the local tsc does not", async () => {
        layout([local.tsc, local.tls], []);

        const { started, attempted } = await startWith([local.tsc]);
        expect(started).toEqual({ command: local.tls, args: ["--stdio"] });
        expect(attempted).toEqual([local.tsc, local.tls]);
      });

      it("never tries an ancestor tsc once the nearest one failed", async () => {
        // local TypeScript 5, hoisted TypeScript 7, global language server
        layout([local.tsc, parentTsc], ["typescript-language-server"]);

        const { started, attempted } = await startWith([local.tsc]);
        expect(started).toEqual({
          command: globalBins["typescript-language-server"],
          args: ["--stdio"],
        });
        expect(attempted).not.toContain(parentTsc);
      });

      it("uses a global tsc when there is none in node_modules", async () => {
        layout([], ["tsc"]);

        const { started } = await startWith([]);
        expect(started).toEqual({
          command: globalBins.tsc,
          args: ["--lsp", "--stdio"],
        });
      });

      it("falls back to the global language server when the global tsc does not start", async () => {
        layout([], ["tsc", "typescript-language-server"]);

        const { started } = await startWith([globalBins.tsc]);
        expect(started).toEqual({
          command: globalBins["typescript-language-server"],
          args: ["--stdio"],
        });
      });

      it("uses a local language server when only a global tsc exists and fails", async () => {
        layout([local.tls], ["tsc"]);

        const { started } = await startWith([globalBins.tsc]);
        expect(started).toEqual({ command: local.tls, args: ["--stdio"] });
      });

      it("ends at npx when nothing is installed", async () => {
        layout([], []);

        const { started } = await startWith([]);
        expect(started).toEqual({
          command: "npx",
          args: ["-y", "typescript-language-server", "--stdio"],
        });
      });

      it("throws the last start error when every candidate fails, trying each once", async () => {
        layout([local.tsc], []);
        const attempted: string[] = [];

        await expect(
          startFirstWorking(
            candidateCommands(strategy, projectRoot),
            async (found) => {
              attempted.push(found.command);
              throw new Error(`${found.command} exited with code 1`);
            },
          ),
        ).rejects.toThrow("npx exited with code 1");
        expect(attempted).toEqual([local.tsc, "npx"]);
      });

      it("findBinary is the first candidate", () => {
        layout([local.tsc, local.tls], []);

        expect(findBinary(strategy, projectRoot)).toEqual({
          command: local.tsc,
          args: ["--lsp", "--stdio"],
        });
      });
    });

    it("prefers an earlier name in a parent over a later name in the project", () => {
      const strategy: BinFindStrategy = {
        strategies: [{ type: "node_modules", names: ["first", "second"] }],
        defaultArgs: [],
      };
      const projectRoot = "/test/project";
      const parentFirst = "/test/node_modules/.bin/first";
      const localSecond = join(projectRoot, "node_modules", ".bin", "second");
      vi.mocked(fs.existsSync).mockImplementation((path) =>
        [parentFirst, localSecond].includes(String(path)),
      );

      expect(findBinary(strategy, projectRoot)).toEqual({
        command: parentFirst,
        args: [],
      });
    });

    it("should find globally installed binary", async () => {
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

    it("should fallback to npx when binary not found", async () => {
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

    it("should return null when no binary found and no npx fallback", async () => {
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

    it("should try multiple search paths", async () => {
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
    it("should use explicit bin and args when provided", async () => {
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

    it("should use binFindStrategy when bin not provided", async () => {
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

    it("should prefer explicit bin/args over binFindStrategy", async () => {
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

    it("should use bin as-is when no args or strategy provided", async () => {
      const adapter = {
        bin: "simple-lsp",
      };

      const result = resolveAdapterCommand(adapter);

      expect(result).toEqual({
        command: "simple-lsp",
        args: [],
      });
    });

    it("should throw error when no binary specified or found", async () => {
      const adapter = {
        binFindStrategy: {
          strategies: [
            { type: "node_modules" as const, names: ["nonexistent"] },
          ],
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

    it("should use default args from strategy when using binFindStrategy", async () => {
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
