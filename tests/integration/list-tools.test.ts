import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("list_tools functionality", () => {
  describe("TypeScript server", () => {
    let client: Client;
    let transport: StdioClientTransport;

    beforeAll(async () => {
      const SERVER_PATH = path.join(__dirname, "../../dist/lsmcp.js");
      await fs.access(SERVER_PATH);

      transport = new StdioClientTransport({
        command: "node",
        args: [SERVER_PATH, "--language=typescript"],
        // @ts-ignore
        env: process.env,
      }) as any;

      client = new Client({
        name: "test-client",
        version: "1.0.0",
      });

      await client.connect(transport);
    }, 30000);

    afterAll(async () => {
      await client.close();
    });

    it("should list TypeScript tools", async () => {
      const result = (await client.callTool({
        name: "list_tools",
        arguments: { category: "typescript" },
      })) as any;

      expect(result.content[0].text).toContain("TypeScript Tools");
      expect(result.content[0].text).toContain("extract_type");
      expect(result.content[0].text).toContain("generate_accessors");
      expect(result.content[0].text).toContain("call_hierarchy");
    });

    it("should list all tools including LSP", async () => {
      const result = (await client.callTool({
        name: "list_tools",
        arguments: { category: "all" },
      })) as any;

      expect(result.content[0].text).toContain("TypeScript Tools");
      expect(result.content[0].text).toContain("LSP Tools");
      expect(result.content[0].text).toContain("find_references");
    });
  });

  describe.skip("Generic LSP server", () => {
    let client: Client;
    let transport: StdioClientTransport;

    beforeAll(async () => {
      const SERVER_PATH = path.join(__dirname, "../../dist/lsmcp.js");
      await fs.access(SERVER_PATH);

      // Use typescript-language-server from node_modules to avoid npx overhead
      const tsLangServerPath = path.join(
        __dirname,
        "../../node_modules/.bin/typescript-language-server",
      );
      transport = new StdioClientTransport({
        command: "node",
        args: [SERVER_PATH, `--bin=${tsLangServerPath}`],
        env: {
          ...process.env,
        },
      });

      client = new Client({
        name: "test-client",
        version: "1.0.0",
      });

      await client.connect(transport);
    }, 30000);

    afterAll(async () => {
      await client.close();
    });

    it("should only list LSP tools, not TypeScript tools", async () => {
      const result = (await client.callTool({
        name: "list_tools",
        arguments: {},
      })) as any;

      expect(result.content[0].text).toContain("LSP Tools");
      expect(result.content[0].text).toContain("find_references");
      expect(result.content[0].text).toContain("get_hover");

      // Should NOT contain TypeScript-specific tools
      expect(result.content[0].text).not.toContain("TypeScript Tools");
      expect(result.content[0].text).not.toContain("extract_type");
      expect(result.content[0].text).not.toContain("generate_accessors");
      expect(result.content[0].text).not.toContain("call_hierarchy");
    });

    it("should ignore category parameter for LSP-only server", async () => {
      // Even with category "all", should only show LSP tools
      const result = (await client.callTool({
        name: "list_tools",
        arguments: { category: "all" },
      })) as any;

      expect(result.content[0].text).toContain("LSP Tools");
      expect(result.content[0].text).not.toContain("TypeScript Tools");
    });
  });
});
