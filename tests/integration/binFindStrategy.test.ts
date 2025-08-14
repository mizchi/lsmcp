import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn } from "child_process";
import { createLSPClient } from "@internal/lsp-client";
import { tsgoAdapter } from "../../src/presets/tsgo.ts";
import { resolveAdapterCommand } from "../../src/utils/binFinder.ts";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("binFindStrategy integration", () => {
  let tmpDir: string;

  beforeEach(async () => {
    // Create temporary directory for test files
    const hash = randomBytes(8).toString("hex");
    tmpDir = path.join(__dirname, `tmp-binfind-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("tsgo preset with binFindStrategy", () => {
    it("should have binFindStrategy defined", () => {
      expect(tsgoAdapter.binFindStrategy).toBeDefined();
      expect(tsgoAdapter.binFindStrategy?.strategies).toBeDefined();
      expect(tsgoAdapter.binFindStrategy?.strategies?.length).toBeGreaterThan(
        0,
      );
      // Check for node_modules strategy
      const nodeModulesStrategy = tsgoAdapter.binFindStrategy?.strategies?.find(
        (s) => s.type === "node_modules",
      );
      expect(nodeModulesStrategy).toBeDefined();
      if (nodeModulesStrategy && "names" in nodeModulesStrategy) {
        expect(nodeModulesStrategy.names).toContain("tsgo");
      }
      // Check for npx strategy
      const npxStrategy = tsgoAdapter.binFindStrategy?.strategies?.find(
        (s) => s.type === "npx",
      );
      expect(npxStrategy).toBeDefined();
      if (npxStrategy && "package" in npxStrategy) {
        expect(npxStrategy.package).toBe("@typescript/native-preview");
      }
      expect(tsgoAdapter.binFindStrategy?.defaultArgs).toEqual([
        "--lsp",
        "--stdio",
      ]);
    });

    it("should not have explicit bin/args", () => {
      expect(tsgoAdapter.bin).toBeUndefined();
      expect(tsgoAdapter.args).toBeUndefined();
    });

    it("should resolve command using binFindStrategy", () => {
      const result = resolveAdapterCommand(tsgoAdapter, tmpDir);

      // Should either find tsgo or fallback to npx
      expect(result).toBeDefined();
      expect(result.command).toBeDefined();
      expect(result.args).toContain("--lsp");
      expect(result.args).toContain("--stdio");

      // If npx fallback is used
      if (result.command === "npx") {
        expect(result.args).toContain("-y");
        expect(result.args).toContain("@typescript/native-preview");
      }
    });
  });

  describe("LSP server startup with binFindStrategy", () => {
    it("should start LSP server using resolved command", async () => {
      // Skip test if tsgo is not installed and npx is not available
      try {
        const { execSync } = await import("child_process");
        try {
          execSync("which tsgo", { stdio: "ignore" });
        } catch {
          // tsgo not found, check if npx is available
          try {
            execSync("which npx", { stdio: "ignore" });
          } catch {
            console.log("Skipping test - neither tsgo nor npx is available");
            return;
          }
        }
      } catch {
        console.log("Skipping test - cannot check for binaries");
        return;
      }

      // Create a simple TypeScript file
      const tsFile = path.join(tmpDir, "test.ts");
      await fs.writeFile(
        tsFile,
        `const message: string = "Hello, World!";
console.log(message);

function add(a: number, b: number): number {
  return a + b;
}

export { add };
`,
      );

      // Resolve command using binFindStrategy
      const { command, args } = resolveAdapterCommand(tsgoAdapter, tmpDir);

      // Start LSP process
      const lspProcess = spawn(command, args, {
        cwd: tmpDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Handle spawn errors
      const spawnError = await new Promise<Error | null>((resolve) => {
        lspProcess.on("error", resolve);
        lspProcess.on("spawn", () => resolve(null));
        // Wait a bit to see if spawn fails
        setTimeout(() => resolve(null), 100);
      });

      if (spawnError) {
        lspProcess.kill();
        throw new Error(`Failed to spawn LSP: ${spawnError.message}`);
      }

      try {
        const client = createLSPClient({
          rootPath: tmpDir,
          process: lspProcess,
          languageId: "typescript",
          initializationOptions: tsgoAdapter.initializationOptions as
            | Record<string, unknown>
            | undefined,
        });

        await client.start();

        // Open the TypeScript file
        const fileUri = `file://${tsFile}`;
        client.openDocument(
          fileUri,
          await fs.readFile(tsFile, "utf8"),
          "typescript",
        );

        // Wait for LSP to process
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Try to get hover information
        const hoverResponse = await client.sendRequest("textDocument/hover", {
          textDocument: { uri: fileUri },
          position: { line: 0, character: 6 }, // Position of 'message'
        });

        expect(hoverResponse).toBeDefined();

        await client.stop();
      } finally {
        // Ensure process is killed
        if (!lspProcess.killed) {
          lspProcess.kill();
        }
      }
    }, 10000);
  });

  describe("fallback behavior", () => {
    it("should use npx fallback when binary not found", async () => {
      // Create a preset with a non-existent binary
      const customPreset = {
        binFindStrategy: {
          strategies: [
            {
              type: "node_modules" as const,
              names: ["non-existent-lsp-server"],
            },
            { type: "npx" as const, package: "@typescript/native-preview" },
          ],
          defaultArgs: ["--lsp", "--stdio"],
        },
      };

      const result = resolveAdapterCommand(customPreset, tmpDir);

      // Should fallback to npx
      expect(result.command).toBe("npx");
      expect(result.args).toContain("-y");
      expect(result.args).toContain("@typescript/native-preview");
      expect(result.args).toContain("--lsp");
      expect(result.args).toContain("--stdio");
    });

    it("should throw error when no binary found and no npx fallback", () => {
      // Create a preset without npx fallback
      const customPreset = {
        binFindStrategy: {
          strategies: [
            {
              type: "node_modules" as const,
              names: ["non-existent-lsp-server"],
            },
          ],
          defaultArgs: ["--lsp"],
        },
      };

      expect(() => resolveAdapterCommand(customPreset, tmpDir)).toThrow(
        "No LSP server binary specified or found",
      );
    });
  });
});
