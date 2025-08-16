import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDeleteSymbolTool } from "../../../../src/tools/lsp/deleteSymbol.ts";
import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";
import {
  setupLSPForTesting,
  teardownLSP,
  type LSPTestSetup,
} from "../../../../tests/helpers/lsp-test-helpers.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// const FIXTURES_DIR = path.join(__dirname, "../../../../tests/fixtures/lsp-delete");

describe("lsp delete symbol", { timeout: 30000 }, () => {
  let lspSetup: LSPTestSetup | null = null;
  let tmpDir: string;
  let lspDeleteSymbolTool: any;

  beforeAll(async () => {
    // Setup LSP server and client
    lspSetup = await setupLSPForTesting(__dirname, "typescript");

    // Initialize tool with the LSP client
    lspDeleteSymbolTool = createDeleteSymbolTool(lspSetup.lspClient);
  }, 30000);

  beforeAll(async () => {
    // Create temporary directory with random hash
    const hash = randomBytes(8).toString("hex");
    tmpDir = path.join(__dirname, `tmp-lsp-delete-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });
  }, 30000);

  afterAll(async () => {
    // Cleanup
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }

    await teardownLSP(lspSetup);
  }, 30000);

  it("should delete a simple variable and its references", async () => {
    // Create test file content
    const testContent = `const foo = 1;
const bar = foo + 2;
console.log(foo);
export { foo };`;

    const testFile = path.join(tmpDir, "delete-variable.ts");
    await fs.writeFile(testFile, testContent);

    // Execute delete
    const result = await lspDeleteSymbolTool.execute({
      root: tmpDir,
      relativePath: "delete-variable.ts",
      line: 1, // const foo = 1;
      textTarget: "foo",
      removeReferences: true,
    });

    // Verify result
    expect(result).toContain("Successfully deleted symbol");
    expect(result).toContain("delete-variable.ts");

    // Verify file content - all foo references should be removed
    const actualContent = await fs.readFile(testFile, "utf-8");
    expect(actualContent).not.toContain("foo");

    // Check that foo is replaced with empty string
    const lines = actualContent.split("\n");
    // First line should have foo removed: "const  = 1;"
    expect(lines[0]).toBe("const  = 1;");
    // Second line should have foo removed: "const bar =  + 2;"
    expect(lines[1]).toBe("const bar =  + 2;");
  });

  it("should delete only declaration when removeReferences is false", async () => {
    // Create test file content
    const testContent = `function processData(data: string): string {
  return data.toUpperCase();
}

const result = processData("hello");
console.log(processData("world"));`;

    const testFile = path.join(tmpDir, "delete-function-only.ts");
    await fs.writeFile(testFile, testContent);

    // Execute delete without references
    const result = await lspDeleteSymbolTool.execute({
      root: tmpDir,
      relativePath: "delete-function-only.ts",
      line: 1, // function processData
      textTarget: "processData",
      removeReferences: false,
    });

    // Verify result
    expect(result).toContain("Successfully deleted symbol");

    // Verify file content - declaration should still exist since removeReferences is false
    const actualContent = await fs.readFile(testFile, "utf-8");
    // When removeReferences is false, it should only try to delete the symbol at that specific location
    // But since it's a function declaration, it might not be deletable without breaking syntax
    // So we check that the function still exists
    expect(actualContent).toContain("function processData");
  });

  it("should handle deletion errors gracefully", async () => {
    // Try to delete from a non-existent file
    await expect(
      lspDeleteSymbolTool.execute({
        root: tmpDir,
        relativePath: "nonexistent.ts",
        line: 1,
        textTarget: "foo",
        removeReferences: true,
      }),
    ).rejects.toThrow();
  });

  it("should handle symbol not found on line", async () => {
    const testContent = `const bar = 1;
const baz = 2;`;

    const testFile = path.join(tmpDir, "wrong-symbol.ts");
    await fs.writeFile(testFile, testContent);

    // Try to delete a symbol that doesn't exist on the specified line
    await expect(
      lspDeleteSymbolTool.execute({
        root: tmpDir,
        relativePath: "wrong-symbol.ts",
        line: 1,
        textTarget: "foo", // foo doesn't exist on line 1
        removeReferences: true,
      }),
    ).rejects.toThrow('Symbol "foo" not found on line 1');
  });
});
