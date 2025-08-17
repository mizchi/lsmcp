import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

describe("Custom LSP without preset", () => {
  describe("TypeScript LSP with custom bin and files", () => {
    let mcpClient: Client;

    beforeAll(async () => {
      const tsLspPath = join(
        projectRoot,
        "node_modules/.bin/typescript-language-server",
      );

      if (!existsSync(tsLspPath)) {
        throw new Error(
          "typescript-language-server not found. Run 'pnpm install' first.",
        );
      }

      const transport = new StdioClientTransport({
        command: "node",
        args: [
          join(projectRoot, "dist/lsmcp.js"),
          "--bin",
          `${tsLspPath} --stdio`,
          "--files",
          "**/*.ts",
        ],
        env: {
          ...process.env,
          DEBUG: "lsmcp:*",
        },
      });

      mcpClient = new Client(
        {
          name: "test-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );

      await mcpClient.connect(transport);
    }, 60000);

    afterAll(async () => {
      if (mcpClient) {
        await mcpClient.close();
      }
    });

    it("should get project overview with custom TypeScript LSP", async () => {
      const fixtureRoot = join(__dirname, "../fixtures/typescript");

      const result = await mcpClient.callTool({
        name: "get_project_overview",
        arguments: {
          root: fixtureRoot,
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);
      expect((result.content as any)[0].type).toBe("text");

      const content = (result.content as any)[0].text;

      expect(content).toContain("## Project Overview");
      expect(content).toContain("### Statistics");
      expect(content).toContain("### Key Components");
      expect(content).toContain(".ts");
    });

    it("should search symbols with custom TypeScript LSP", async () => {
      const fixtureRoot = join(__dirname, "../fixtures/typescript");

      // search_symbols will auto-create the index on first use
      const result = await mcpClient.callTool({
        name: "search_symbols",
        arguments: {
          root: fixtureRoot,
          query: "greetUser",
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);

      const content = (result.content as any)[0].text;
      expect(content).toContain("greetUser");
    });

    it("should get document symbols with custom TypeScript LSP", async () => {
      const fixtureRoot = join(__dirname, "../fixtures/typescript");

      const result = await mcpClient.callTool({
        name: "lsp_get_document_symbols",
        arguments: {
          root: fixtureRoot,
          relativePath: "src/index.ts",
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);

      const content = (result.content as any)[0].text;
      expect(content).toBeDefined();
    });
  });

  describe("Python LSP with custom bin and files", () => {
    let mcpClient: Client;
    const pyrightExists =
      existsSync("/usr/bin/pyright") || existsSync("/usr/local/bin/pyright");

    beforeAll(async () => {
      if (!pyrightExists) {
        return;
      }

      const pyrightPath = existsSync("/usr/bin/pyright")
        ? "/usr/bin/pyright"
        : "/usr/local/bin/pyright";

      const transport = new StdioClientTransport({
        command: "node",
        args: [
          join(projectRoot, "dist/lsmcp.js"),
          "--bin",
          `${pyrightPath} --stdio`,
          "--files",
          "**/*.py",
        ],
        env: {
          ...process.env,
          DEBUG: "lsmcp:*",
        },
      });

      mcpClient = new Client(
        {
          name: "test-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );

      await mcpClient.connect(transport);
    }, 60000);

    afterAll(async () => {
      if (mcpClient) {
        await mcpClient.close();
      }
    });

    const testFn = pyrightExists ? it : it.skip;

    testFn("should get project overview with custom Python LSP", async () => {
      const fixtureRoot = join(__dirname, "../fixtures/python");

      const result = await mcpClient.callTool({
        name: "get_project_overview",
        arguments: {
          root: fixtureRoot,
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);
      expect((result.content as any)[0].type).toBe("text");

      const content = (result.content as any)[0].text;

      expect(content).toContain("## Project Overview");
      expect(content).toContain("### Statistics");
      expect(content).toContain("### Key Components");
      expect(content).toContain(".py");
    });

    testFn("should search symbols with custom Python LSP", async () => {
      const fixtureRoot = join(__dirname, "../fixtures/python");

      // search_symbols will auto-create the index on first use
      const result = await mcpClient.callTool({
        name: "search_symbols",
        arguments: {
          root: fixtureRoot,
          query: "Calculator",
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);

      const content = (result.content as any)[0].text;
      expect(content).toContain("Calculator");
    });
  });

  describe("Veryl LSP with custom bin and files", () => {
    let mcpClient: Client;
    const verylLsPath = "/home/mizchi/.cargo/bin/veryl-ls";
    const verylLsExists = existsSync(verylLsPath);

    beforeAll(async () => {
      if (!verylLsExists) {
        return;
      }

      const transport = new StdioClientTransport({
        command: "node",
        args: [
          join(projectRoot, "dist/lsmcp.js"),
          "--bin",
          `${verylLsPath} --stdio`,
          "--files",
          "**/*.veryl",
        ],
        env: {
          ...process.env,
          DEBUG: "lsmcp:*",
        },
      });

      mcpClient = new Client(
        {
          name: "test-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );

      await mcpClient.connect(transport);
    }, 60000);

    afterAll(async () => {
      if (mcpClient) {
        await mcpClient.close();
      }
    });

    const testFn = verylLsExists ? it : it.skip;

    testFn("should connect to Veryl LSP and get project overview", async () => {
      const fixtureRoot = join(__dirname, "../fixtures/veryl");

      const result = await mcpClient.callTool({
        name: "get_project_overview",
        arguments: {
          root: fixtureRoot,
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);
      expect((result.content as any)[0].type).toBe("text");

      const content = (result.content as any)[0].text;

      // Basic structure should be present
      expect(content).toContain("## Project Overview");
      expect(content).toContain("### Statistics");

      // Note: Veryl LSP may not provide symbol indexing,
      // but the connection itself should work
    });

    testFn("should attempt to search symbols with Veryl LSP", async () => {
      const fixtureRoot = join(__dirname, "../fixtures/veryl");

      // search_symbols will auto-create the index on first use
      const result = await mcpClient.callTool({
        name: "search_symbols",
        arguments: {
          root: fixtureRoot,
          query: "module",
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);

      // The result might be empty if Veryl LSP doesn't support workspace symbols
      // But the tool should at least execute without error
      const content = (result.content as any)[0].text;
      expect(content).toBeDefined();
    });

    testFn("should get document symbols with Veryl LSP", async () => {
      const fixtureRoot = join(__dirname, "../fixtures/veryl");

      const result = await mcpClient.callTool({
        name: "lsp_get_document_symbols",
        arguments: {
          root: fixtureRoot,
          relativePath: "counter.veryl",
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);

      const content = (result.content as any)[0].text;
      // Check if it contains module information or error message
      // Some LSPs may not support document symbols for all file types
      expect(content).toBeDefined();
    });
  });

  describe("Custom command with specific file patterns", () => {
    let mcpClient: Client;

    beforeAll(async () => {
      const tsLspPath = join(
        projectRoot,
        "node_modules/.bin/typescript-language-server",
      );

      if (!existsSync(tsLspPath)) {
        throw new Error(
          "typescript-language-server not found. Run 'pnpm install' first.",
        );
      }

      const transport = new StdioClientTransport({
        command: "node",
        args: [
          join(projectRoot, "dist/lsmcp.js"),
          "--bin",
          `${tsLspPath} --stdio`,
          "--files",
          "src/**/*.ts",
        ],
        env: {
          ...process.env,
          DEBUG: "lsmcp:*",
        },
      });

      mcpClient = new Client(
        {
          name: "test-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );

      await mcpClient.connect(transport);
    }, 60000);

    afterAll(async () => {
      if (mcpClient) {
        await mcpClient.close();
      }
    });

    it("should only index files matching the pattern", async () => {
      const fixtureRoot = join(__dirname, "../fixtures/typescript-with-src");

      // First, trigger index creation by searching
      await mcpClient.callTool({
        name: "search_symbols",
        arguments: {
          root: fixtureRoot,
          query: "Calculator",
        },
      });

      const result = await mcpClient.callTool({
        name: "get_project_overview",
        arguments: {
          root: fixtureRoot,
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toHaveLength(1);
      expect((result.content as any)[0].type).toBe("text");

      const content = (result.content as any)[0].text;

      expect(content).toContain("## Project Overview");
      // Since we're filtering by src/**/*.ts, it should contain src/ files
      expect(content).toContain("src/");
      // And should not contain test files
      expect(content).not.toContain("tests/");
    });
  });
});
