import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { randomBytes } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, "../../dist/lsmcp.js");

describe("MCP TypeScript Tools", () => {
  let client: Client;
  let transport: StdioClientTransport;
  let tmpDir: string;

  beforeEach(async () => {
    // Create temporary directory
    const hash = randomBytes(8).toString("hex");
    tmpDir = path.join(__dirname, `tmp-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });

    // Create a minimal tsconfig.json to make it a TypeScript project
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

    // Create transport with server parameters
    const cleanEnv = { ...process.env } as Record<string, string>;
    // Ensure TypeScript-specific tools are enabled
    delete cleanEnv.FORCE_LSP;
    delete cleanEnv.LSP_COMMAND;

    transport = new StdioClientTransport({
      command: "node",
      args: [SERVER_PATH, "-p", "typescript"],
      env: cleanEnv,
      cwd: tmpDir, // Use cwd instead of --project-root
    });

    // Create and connect client
    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);
  }, 20000); // 20 second timeout for setup

  afterEach(async () => {
    try {
      // Close client and transport
      if (client) {
        await client.close();
      }
    } catch (error) {
      console.error("Error during client cleanup:", error);
    }

    // Clean up temp directory
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch (error) {
      console.error("Error during temp directory cleanup:", error);
    }
  }, 10000); // 10 second timeout for cleanup

  it("should connect to MCP server successfully", async () => {
    // Test that the client connected successfully
    expect(client).toBeDefined();

    // List available tools
    const tools = await client.listTools();
    expect(tools).toBeDefined();
    expect(tools.tools).toBeDefined();
    expect(Array.isArray(tools.tools)).toBe(true);
    expect(tools.tools.length).toBeGreaterThan(0);
  });
});
