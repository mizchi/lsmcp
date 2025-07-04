import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { randomBytes } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, "../../dist/lsmcp.js");

describe("TypeScript New Tools Basic Integration", () => {
  let client: Client;
  let transport: StdioClientTransport;
  let tmpDir: string;

  beforeEach(async () => {
    // Create temporary directory
    const hash = randomBytes(8).toString("hex");
    tmpDir = path.join(__dirname, `tmp-ts-new-tools-basic-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });

    // Create a minimal tsconfig.json
    await fs.writeFile(
      path.join(tmpDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "es2020",
            module: "commonjs",
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
          },
        },
        null,
        2,
      ),
    );

    // Create transport with LSP configuration
    transport = new StdioClientTransport({
      command: "node",
      args: [SERVER_PATH, "--language=typescript"],
      env: process.env as Record<string, string>,
      cwd: tmpDir,
    });

    // Create and connect client
    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);
  }, 20000);

  afterEach(async () => {
    try {
      if (client) {
        await client.close();
      }
    } catch (error) {
      console.error("Error during client cleanup:", error);
    }

    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      console.error("Error during temp directory cleanup:", error);
    }
  }, 10000);

  describe("Tool availability", () => {
    it("should list the new TypeScript tools", async () => {
      const response = await client.listTools();
      const toolNames = response.tools.map((t) => t.name);

      // Check that the new tools are available
      expect(toolNames).toContain("extract_type");
      expect(toolNames).toContain("generate_accessors");
      expect(toolNames).toContain("call_hierarchy");
    });
  });

  describe("Tool error handling", () => {
    it("should handle non-existent file gracefully for extract_type", async () => {
      const result = await client.callTool({
        name: "extract_type",
        arguments: {
          root: tmpDir,
          filePath: "non-existent.ts",
          startLine: 1,
          extractType: "type",
          typeName: "Test",
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      const contents = result.content as Array<{ type: string; text?: string }>;
      expect(contents.length).toBeGreaterThan(0);
      if (contents[0].type === "text") {
        expect(contents[0].text).toMatch(
          /Error:|ENOENT|not found|does not exist/i,
        );
      }
    });

    it("should handle non-existent file gracefully for generate_accessors", async () => {
      const result = await client.callTool({
        name: "generate_accessors",
        arguments: {
          root: tmpDir,
          filePath: "non-existent.ts",
          line: 1,
          propertyName: "test",
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      const contents = result.content as Array<{ type: string; text?: string }>;
      expect(contents.length).toBeGreaterThan(0);
      if (contents[0].type === "text") {
        expect(contents[0].text).toMatch(
          /Error:|ENOENT|not found|does not exist/i,
        );
      }
    });

    it("should handle non-existent file gracefully for call_hierarchy", async () => {
      const result = await client.callTool({
        name: "call_hierarchy",
        arguments: {
          root: tmpDir,
          filePath: "non-existent.ts",
          line: 1,
          symbolName: "test",
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      const contents = result.content as Array<{ type: string; text?: string }>;
      expect(contents.length).toBeGreaterThan(0);
      if (contents[0].type === "text") {
        expect(contents[0].text).toMatch(
          /Error:|ENOENT|not found|does not exist/i,
        );
      }
    });
  });

  describe("Basic functionality", () => {
    it("should handle simple TypeScript file for call_hierarchy", async () => {
      // Create a simple TypeScript file
      const testFile = path.join(tmpDir, "simple.ts");
      await fs.writeFile(
        testFile,
        `function simpleFunction() {
  return 42;
}

function caller() {
  return simpleFunction();
}`,
      );

      // Wait a bit to ensure file is written
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Try to get call hierarchy - even if it returns no results, it shouldn't crash
      const result = await client.callTool({
        name: "call_hierarchy",
        arguments: {
          root: tmpDir,
          filePath: "simple.ts",
          line: "function simpleFunction",
          symbolName: "simpleFunction",
          direction: "incoming",
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      const contents = result.content as Array<{ type: string; text?: string }>;
      if (contents.length > 0 && contents[0].type === "text") {
        const text = contents[0].text!;
        // Check for various possible outcomes
        expect(text).toMatch(
          /simpleFunction|call hierarchy|not supported|no call hierarchy/i,
        );
      }
    }, 10000); // Increase timeout
  });
});
