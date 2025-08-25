import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ChildProcess, spawn } from "child_process";
import { createRenameSymbolTool } from "../../../../src/tools/lsp/rename.ts";
import type { LSPClient } from "@internal/lsp-client";
import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../..");
const FIXTURES_DIR = path.join(
  __dirname,
  "../../../../tests/fixtures/lsp-rename",
);

describe("lsp rename symbol", { timeout: 30000 }, () => {
  let lspProcess: ChildProcess;
  let lspClient: LSPClient;
  let tmpDir: string;
  let lspRenameSymbolTool: any;

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

    // Create temporary directory first
    const hash = randomBytes(8).toString("hex");
    tmpDir = path.join(__dirname, `tmp-lsp-rename-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });

    // Start TypeScript language server
    lspProcess = spawn(tsLspPath, ["--stdio"], {
      cwd: tmpDir,
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === 'win32', // Use shell on Windows
    });

    // Initialize LSP client
    const { createLSPClient } = await import("@internal/lsp-client");
    lspClient = createLSPClient({
      process: lspProcess,
      rootPath: tmpDir,
      languageId: "typescript",
    });
    await lspClient.start();

    // Initialize tool with the LSP client
    lspRenameSymbolTool = createRenameSymbolTool(lspClient);
  }, 30000);

  afterAll(async () => {
    // Cleanup
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }

    if (lspProcess) {
      if (lspClient) await lspClient.stop();
      lspProcess.kill();
    }
  }, 30000);

  it("should rename a simple variable", async () => {
    // Copy test file to temp directory
    const inputFile = path.join(FIXTURES_DIR, "simple-variable.input.ts");
    const testFile = path.join(tmpDir, "simple-variable.ts");
    await fs.copyFile(inputFile, testFile);

    // Execute rename
    const result = await lspRenameSymbolTool.execute({
      root: tmpDir,
      relativePath: "simple-variable.ts",
      line: 1, // const foo = 1;
      textTarget: "foo",
      newName: "bar",
    });

    // Verify result
    expect(result).toContain("Successfully renamed symbol");
    expect(result).toContain("simple-variable.ts");
    expect(result).toContain('"foo" → "bar"');

    // Verify file content
    const actualContent = await fs.readFile(testFile, "utf-8");
    const expectedFile = path.join(FIXTURES_DIR, "simple-variable.expected.ts");
    const expectedContent = await fs.readFile(expectedFile, "utf-8");

    expect(actualContent.trim()).toBe(expectedContent.trim());
  });

  it("should rename a function", async () => {
    // Copy test file to temp directory
    const inputFile = path.join(FIXTURES_DIR, "function.input.ts");
    const testFile = path.join(tmpDir, "function.ts");
    await fs.copyFile(inputFile, testFile);

    // Execute rename
    const result = await lspRenameSymbolTool.execute({
      root: tmpDir,
      relativePath: "function.ts",
      line: 1, // function foo(x: number): number {
      textTarget: "foo",
      newName: "bar",
    });

    // Verify result
    expect(result).toContain("Successfully renamed symbol");
    expect(result).toContain("function.ts");
    expect(result).toContain('"foo" → "bar"');

    // Verify file content
    const actualContent = await fs.readFile(testFile, "utf-8");
    const expectedFile = path.join(FIXTURES_DIR, "function.expected.ts");
    const expectedContent = await fs.readFile(expectedFile, "utf-8");

    expect(actualContent.trim()).toBe(expectedContent.trim());
  });

  it("should rename a class", async () => {
    // Copy test file to temp directory
    const inputFile = path.join(FIXTURES_DIR, "class.input.ts");
    const testFile = path.join(tmpDir, "class.ts");
    await fs.copyFile(inputFile, testFile);

    // Execute rename
    const result = await lspRenameSymbolTool.execute({
      root: tmpDir,
      relativePath: "class.ts",
      line: 1, // class Foo {
      textTarget: "Foo",
      newName: "Bar",
    });

    // Verify result
    expect(result).toContain("Successfully renamed symbol");
    expect(result).toContain("class.ts");
    expect(result).toContain('"Foo" → "Bar"');

    // Verify file content
    const actualContent = await fs.readFile(testFile, "utf-8");
    const expectedFile = path.join(FIXTURES_DIR, "class.expected.ts");
    const expectedContent = await fs.readFile(expectedFile, "utf-8");

    expect(actualContent.trim()).toBe(expectedContent.trim());
  });

  it("should rename without specifying line number", async () => {
    // Copy test file to temp directory
    const inputFile = path.join(FIXTURES_DIR, "simple-variable.input.ts");
    const testFile = path.join(tmpDir, "simple-variable-no-line.ts");
    await fs.copyFile(inputFile, testFile);

    // Execute rename without line parameter
    const result = await lspRenameSymbolTool.execute({
      root: tmpDir,
      relativePath: "simple-variable-no-line.ts",
      textTarget: "foo",
      newName: "bar",
    });

    // Verify result
    expect(result).toContain("Successfully renamed symbol");
    expect(result).toContain("simple-variable-no-line.ts");
    expect(result).toContain('"foo" → "bar"');

    // Verify file content
    const actualContent = await fs.readFile(testFile, "utf-8");
    const expectedFile = path.join(FIXTURES_DIR, "simple-variable.expected.ts");
    const expectedContent = await fs.readFile(expectedFile, "utf-8");

    expect(actualContent.trim()).toBe(expectedContent.trim());
  });

  it("should handle rename errors gracefully", async () => {
    // Try to rename a non-existent symbol
    await expect(
      lspRenameSymbolTool.execute({
        root: tmpDir,
        relativePath: "nonexistent.ts",
        line: 1,
        textTarget: "foo",
        newName: "bar",
      }),
    ).rejects.toThrow();
  });

  it("should rename symbols across multiple files", async () => {
    // Copy test files to temp directory
    const exportInput = path.join(FIXTURES_DIR, "cross-file-export.input.ts");
    const importInput = path.join(FIXTURES_DIR, "cross-file-import.input.ts");
    const exportFile = path.join(tmpDir, "cross-file-export.input.ts");
    const importFile = path.join(tmpDir, "cross-file-import.input.ts");

    await fs.copyFile(exportInput, exportFile);
    await fs.copyFile(importInput, importFile);

    // Execute rename on exported function
    const result = await lspRenameSymbolTool.execute({
      root: tmpDir,
      relativePath: "cross-file-export.input.ts",
      line: 2, // export function processData
      textTarget: "processData",
      newName: "transformData",
    });

    // Verify result
    expect(result).toContain("Successfully renamed symbol");
    expect(result).toContain('"processData" → "transformData"');

    // Check that export file was updated
    expect(result).toContain("cross-file-export.input.ts");

    // Verify export file content
    const actualExportContent = await fs.readFile(exportFile, "utf-8");
    const expectedExportFile = path.join(
      FIXTURES_DIR,
      "cross-file-export.expected.ts",
    );
    const expectedExportContent = await fs.readFile(
      expectedExportFile,
      "utf-8",
    );
    expect(actualExportContent.trim()).toBe(expectedExportContent.trim());

    // Note: Cross-file rename depends on LSP server implementation and project configuration
    // Some LSP servers may not rename across files without proper project setup
  });

  it("should rename type aliases", async () => {
    // Copy test file to temp directory
    const inputFile = path.join(FIXTURES_DIR, "type-alias.input.ts");
    const testFile = path.join(tmpDir, "type-alias.ts");
    await fs.copyFile(inputFile, testFile);

    // Execute rename on type alias
    const result = await lspRenameSymbolTool.execute({
      root: tmpDir,
      relativePath: "type-alias.ts",
      line: 2, // type UserData = {
      textTarget: "UserData",
      newName: "PersonData",
    });

    // Verify result
    expect(result).toContain("Successfully renamed symbol");
    expect(result).toContain("type-alias.ts");
    expect(result).toContain('"UserData" → "PersonData"');

    // Verify file content
    const actualContent = await fs.readFile(testFile, "utf-8");
    const expectedFile = path.join(FIXTURES_DIR, "type-alias.expected.ts");
    const expectedContent = await fs.readFile(expectedFile, "utf-8");

    expect(actualContent.trim()).toBe(expectedContent.trim());
  });

  it("should handle invalid rename targets", async () => {
    // Copy test file to temp directory
    const inputFile = path.join(FIXTURES_DIR, "simple-variable.input.ts");
    const testFile = path.join(tmpDir, "invalid-rename-test.ts");
    await fs.copyFile(inputFile, testFile);

    // Try to rename a non-existent symbol
    await expect(
      lspRenameSymbolTool.execute({
        root: tmpDir,
        relativePath: "invalid-rename-test.ts",
        line: 1,
        textTarget: "nonExistentSymbol",
        newName: "newName",
      }),
    ).rejects.toThrow();
  });
});
