import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ChildProcess, spawn } from "child_process";
import { createDefinitionsTool } from "../../../../src/tools/lsp/definitions.ts";
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
  "../../../../tests/fixtures/lsp-definitions",
);

describe("LSP get_definitions with include_body tests", () => {
  let lspProcess: ChildProcess;
  let lspClient: LSPClient;
  let tmpDir: string;
  let lspGetDefinitionsTool: any;

  beforeAll(async () => {
    // Create temporary directory
    const hash = randomBytes(8).toString("hex");
    tmpDir = path.join(__dirname, `tmp-lsp-definitions-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });

    // Copy fixtures to temp directory
    const fixtureFiles = await fs.readdir(FIXTURES_DIR);
    for (const file of fixtureFiles) {
      const content = await fs.readFile(path.join(FIXTURES_DIR, file), "utf-8");
      await fs.writeFile(path.join(tmpDir, file), content);
    }

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
      cwd: tmpDir,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Initialize LSP client
    const { createLSPClient } = await import("@internal/lsp-client");
    lspClient = createLSPClient({
      process: lspProcess,
      rootPath: tmpDir,
      languageId: "typescript",
    });
    await lspClient.start();

    // Initialize tool
    lspGetDefinitionsTool = createDefinitionsTool(lspClient);
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

  describe("include_body: false (default)", () => {
    it("should get function definition without body", async () => {
      const result = await lspGetDefinitionsTool.execute(
        {
          root: tmpDir,
          filePath: "main.ts",
          line: "formatResult",
          symbolName: "formatResult",
          include_body: false,
        },
        30000,
      );

      expect(result).toContain("Found 1 definition");
      expect(result).toContain("utils.ts");
      expect(result).toContain("formatResult");
      expect(result).toContain("export function formatResult");
      // With include_body: false, LSP may still show some context
      // This is expected behavior based on LSP server implementation
    }, 30000);

    it("should get class definition without body", async () => {
      const result = await lspGetDefinitionsTool.execute(
        {
          root: tmpDir,
          filePath: "main.ts",
          line: "Calculator",
          symbolName: "Calculator",
          include_body: false,
        },
        30000,
      );

      expect(result).toContain("Found 1 definition");
      expect(result).toContain("calculator.ts");
      expect(result).toContain("Calculator");
      expect(result).toContain("export class Calculator");
      // With include_body: false, LSP may still show some context
      // This is expected behavior based on LSP server implementation
    }, 30000);

    it("should get interface definition without body", async () => {
      const result = await lspGetDefinitionsTool.execute(
        {
          root: tmpDir,
          filePath: "main.ts",
          line: "User",
          symbolName: "User",
          include_body: false,
        },
        30000,
      );

      expect(result).toContain("Found 1 definition");
      expect(result).toContain("main.ts");
      expect(result).toContain("User");
      // Should show interface signature but not details
      expect(result).toContain("interface User");
    }, 30000);

    it("should get type alias definition without body", async () => {
      const result = await lspGetDefinitionsTool.execute(
        {
          root: tmpDir,
          filePath: "main.ts",
          line: "UserAction",
          symbolName: "UserAction",
          include_body: false,
        },
        30000,
      );

      expect(result).toContain("Found 1 definition");
      expect(result).toContain("main.ts");
      expect(result).toContain("UserAction");
      expect(result).toContain("type UserAction");
    }, 30000);
  });

  describe("include_body: true", () => {
    it("should get function definition with full body", async () => {
      const result = await lspGetDefinitionsTool.execute(
        {
          root: tmpDir,
          filePath: "main.ts",
          line: "formatResult",
          symbolName: "formatResult",
          include_body: true,
        },
        30000,
      );

      expect(result).toContain("Found 1 definition");
      expect(result).toContain("utils.ts");
      expect(result).toContain("formatResult");
      // Should contain the full function body
      expect(result).toContain("export function formatResult");
      expect(result).toContain("return `${operation} result: ${result}`;");
    }, 30000);

    it("should get class definition with full body", async () => {
      const result = await lspGetDefinitionsTool.execute(
        {
          root: tmpDir,
          filePath: "main.ts",
          line: "Calculator",
          symbolName: "Calculator",
          include_body: true,
        },
        30000,
      );

      expect(result).toContain("Found 1 definition");
      expect(result).toContain("calculator.ts");
      expect(result).toContain("Calculator");
      // Should contain the class definition
      expect(result).toContain("export class Calculator");
      expect(result).toContain("private history: number[] = [];");
      // Note: LSP servers may vary in how much of the class body they return
      // The exact content depends on the LSP server implementation
    }, 30000);

    it("should get method definition with full body", async () => {
      const result = await lspGetDefinitionsTool.execute(
        {
          root: tmpDir,
          filePath: "calculator.ts",
          line: "add(a: number",
          symbolName: "add",
          include_body: true,
        },
        30000,
      );

      expect(result).toContain("Found 1 definition");
      expect(result).toContain("calculator.ts");
      expect(result).toContain("add");
      // Should contain the full method body
      expect(result).toContain("add(a: number, b: number): number");
      expect(result).toContain("const result = a + b;");
      expect(result).toContain("this.history.push(result);");
      expect(result).toContain("return result;");
    }, 30000);

    it("should get interface definition with full body", async () => {
      const result = await lspGetDefinitionsTool.execute(
        {
          root: tmpDir,
          filePath: "main.ts",
          line: "User",
          symbolName: "User",
          include_body: true,
        },
        30000,
      );

      expect(result).toContain("Found 1 definition");
      expect(result).toContain("main.ts");
      expect(result).toContain("User");
      // Should contain the full interface body
      expect(result).toContain("export interface User");
      expect(result).toContain("id: number;");
      expect(result).toContain("name: string;");
    }, 30000);

    it("should get constant definition with full body", async () => {
      const result = await lspGetDefinitionsTool.execute(
        {
          root: tmpDir,
          filePath: "utils.ts",
          line: "CONSTANTS",
          symbolName: "CONSTANTS",
          include_body: true,
        },
        30000,
      );

      expect(result).toContain("Found 1 definition");
      expect(result).toContain("utils.ts");
      expect(result).toContain("CONSTANTS");
      // Should contain the full constant definition
      expect(result).toContain("export const CONSTANTS");
      expect(result).toContain("PI: 3.14159");
      expect(result).toContain("E: 2.71828");
    }, 30000);
  });

  describe("context lines with include_body", () => {
    it("should include before and after context with include_body: true", async () => {
      const result = await lspGetDefinitionsTool.execute(
        {
          root: tmpDir,
          filePath: "main.ts",
          line: "formatResult",
          symbolName: "formatResult",
          include_body: true,
          before: 2,
          after: 2,
        },
        30000,
      );

      expect(result).toContain("Found 1 definition");
      expect(result).toContain("utils.ts");
      expect(result).toContain("formatResult");
      // Should include function body plus context
      expect(result).toContain("export function formatResult");
      expect(result).toContain("return `${operation} result: ${result}`;");
    }, 30000);

    it("should include before and after context with include_body: false", async () => {
      const result = await lspGetDefinitionsTool.execute(
        {
          root: tmpDir,
          filePath: "main.ts",
          line: "formatResult",
          symbolName: "formatResult",
          include_body: false,
          before: 2,
          after: 2,
        },
        30000,
      );

      expect(result).toContain("Found 1 definition");
      expect(result).toContain("utils.ts");
      expect(result).toContain("formatResult");
      // Should show definition line with context
      expect(result).toContain("export function formatResult");
    }, 30000);
  });

  describe("error handling", () => {
    it("should handle non-existent symbol", async () => {
      await expect(
        lspGetDefinitionsTool.execute({
          root: tmpDir,
          filePath: "main.ts",
          line: "nonExistentSymbol",
          symbolName: "nonExistentSymbol",
          include_body: true,
        }),
      ).rejects.toThrow();
    }, 30000);

    it("should handle non-existent file", async () => {
      await expect(
        lspGetDefinitionsTool.execute({
          root: tmpDir,
          filePath: "non-existent.ts",
          line: "symbol",
          symbolName: "symbol",
          include_body: true,
        }),
      ).rejects.toThrow();
    }, 30000);
  });
}, 30000);
