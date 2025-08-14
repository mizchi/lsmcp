import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ChildProcess, spawn } from "child_process";
import { createDocumentSymbolsTool } from "../../src/tools/lsp/documentSymbols.ts";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const FIXTURES_DIR = path.join(__dirname, "fixtures");

describe("lsp document symbols", { timeout: 30000 }, () => {
  let lspProcess: ChildProcess;
  let lspClient: any;
  let lspGetDocumentSymbolsTool: any;

  beforeAll(async () => {
    // Resolve typescript-language-server from project root
    const tsLspPath = path.join(
      projectRoot,
      "node_modules",
      ".bin",
      "typescript-language-server",
    );
    if (!existsSync(tsLspPath)) {
      throw new Error(
        `typescript-language-server not found at ${tsLspPath}. Please run 'pnpm install' first.`,
      );
    }

    // Start TypeScript language server
    lspProcess = spawn(tsLspPath, ["--stdio"], {
      cwd: __dirname,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Initialize LSP client
    const { createLSPClient } = await import("@internal/lsp-client");
    lspClient = createLSPClient({
      process: lspProcess,
      rootPath: __dirname,
      languageId: "typescript",
    });
    await lspClient.start();

    // Initialize tool with the LSP client
    lspGetDocumentSymbolsTool = createDocumentSymbolsTool(lspClient);
  }, 30000);

  afterAll(async () => {
    if (lspProcess) {
      if (lspClient) await lspClient.stop();
      lspProcess.kill();
    }
  }, 30000);

  it("should get document symbols from a TypeScript file", async () => {
    const result = await lspGetDocumentSymbolsTool.execute({
      root: FIXTURES_DIR,
      filePath: "document-symbols-test.ts",
    });

    // Verify result contains expected symbols
    expect(result).toContain("Document symbols in document-symbols-test.ts");
    expect(result).toContain("User [Interface]");
    expect(result).toContain("UserService [Class]");
    expect(result).toContain("processUser [Function]");
    expect(result).toContain("defaultUser [Constant]"); // TypeScript LSP reports const as Constant

    // Check for class members
    expect(result).toContain("users [Property]");
    expect(result).toContain("constructor [Constructor]");
    expect(result).toContain("addUser [Method]");
    expect(result).toContain("getUser [Method]");
    expect(result).toContain("userCount [Method]"); // getter is reported as Method

    // Check for interface members
    expect(result).toContain("id [Property]");
    expect(result).toContain("name [Property]");
    expect(result).toContain("email [Property]");
  });

  it("should handle files with no symbols", async () => {
    // Create an empty test file
    const emptyFile = path.join(FIXTURES_DIR, "empty.ts");
    await import("fs/promises").then((fs) =>
      fs.writeFile(emptyFile, "// Empty file\n"),
    );

    try {
      const result = await lspGetDocumentSymbolsTool.execute({
        root: FIXTURES_DIR,
        filePath: "empty.ts",
      });

      expect(result).toBe("No symbols found in empty.ts");
    } finally {
      // Clean up
      await import("fs/promises").then((fs) =>
        fs.unlink(emptyFile).catch(() => {}),
      );
    }
  });

  it("should handle non-existent files", async () => {
    await expect(
      lspGetDocumentSymbolsTool.execute({
        root: FIXTURES_DIR,
        filePath: "non-existent.ts",
      }),
    ).rejects.toThrow();
  });
});
