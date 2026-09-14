import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(__dirname, "../../dist/lsmcp.js");
const fixtureDir = join(__dirname, "../fixtures/typescript7");
const tscPath = join(fixtureDir, "node_modules/.bin/tsc");
const scratchPath = join(fixtureDir, "scratch.ts");

interface TextContent {
  type: "text";
  text: string;
}

interface ToolResult {
  content: TextContent[];
}

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const result = (await client.callTool({
    name,
    arguments: args,
  })) as ToolResult;
  return result.content[0]?.text ?? "";
}

describe("TypeScript 7 (tsc --lsp) end-to-end", () => {
  let mcpClient: Client;
  let transport: StdioClientTransport;
  let serverStderr = "";

  beforeAll(async () => {
    const version = existsSync(tscPath)
      ? execFileSync(tscPath, ["--version"], { encoding: "utf-8" })
      : "";
    if (!version.startsWith("Version 7")) {
      throw new Error(
        "tests/fixtures/typescript7 has no TypeScript 7: run 'pnpm install'",
      );
    }

    await writeFile(
      scratchPath,
      "export function oldName(): number {\n  return 1;\n}\nexport const unused = 2;\nexport const value = oldName();\n",
    );

    transport = new StdioClientTransport({
      command: "node",
      args: [SERVER_PATH, "-p", "typescript"],
      cwd: fixtureDir,
      env: { ...process.env, MCP_DEBUG: "true" },
      stderr: "pipe",
    });
    transport.stderr?.on("data", (chunk: Buffer) => {
      serverStderr += chunk.toString();
    });

    mcpClient = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} },
    );
    await mcpClient.connect(transport);
  }, 30000);

  afterAll(async () => {
    if (mcpClient) {
      await mcpClient.close();
    }
    await rm(scratchPath, { force: true });
  });

  it("starts the fixture's own tsc without falling back", () => {
    expect(serverStderr).toContain(
      `[MCP:BinFinder] Found in node_modules: ${tscPath}`,
    );
    expect(serverStderr).not.toContain("failed to start");
    expect(serverStderr).not.toContain("typescript-language-server");
  });

  it("gets hover for greetUser", async () => {
    const content = await callTool(mcpClient, "lsp_get_hover", {
      root: fixtureDir,
      relativePath: "index.ts",
      line: 6,
      textTarget: "greetUser",
    });

    expect(content).toContain("greetUser");
    expect(content).toContain("User");
  });

  it("finds references to User", async () => {
    const content = await callTool(mcpClient, "lsp_find_references", {
      root: fixtureDir,
      relativePath: "index.ts",
      line: 1,
      symbolName: "User",
    });

    const match = content.match(/^Found (\d+) references to "User"$/m);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(2);
    expect(content).toContain("index.ts:");
  });

  it("gets the definition of greetUser from its call site", async () => {
    const content = await callTool(mcpClient, "lsp_get_definitions", {
      root: fixtureDir,
      relativePath: "index.ts",
      line: 12,
      symbolName: "greetUser",
    });

    expect(content).toContain('Found 1 definition for "greetUser"');
    expect(content).toContain("index.ts:6:");
  });

  it("reports the type error in diagnostics.ts", async () => {
    const content = await callTool(mcpClient, "lsp_get_diagnostics", {
      root: fixtureDir,
      relativePath: "diagnostics.ts",
    });

    expect(content).toContain("Found 1 diagnostic(s):");
    expect(content).toContain(
      "ERROR: Type 'string' is not assignable to type 'number'.",
    );
    expect(content).toContain("at line 1:");
  });

  it("renames oldName to newName in scratch.ts", async () => {
    const content = await callTool(mcpClient, "lsp_rename_symbol", {
      root: fixtureDir,
      relativePath: "scratch.ts",
      line: 1,
      textTarget: "oldName",
      newName: "newName",
    });

    expect(content).toContain(
      "Successfully renamed symbol in 1 file(s) with 2 change(s)",
    );
    expect(content).toContain("scratch.ts:");

    const scratch = await readFile(scratchPath, "utf-8");
    expect(scratch).toContain("export function newName(): number");
    expect(scratch).toContain("export const value = newName();");
    expect(scratch).not.toContain("oldName");
  });

  it("deletes unused from scratch.ts", async () => {
    const content = await callTool(mcpClient, "lsp_delete_symbol", {
      root: fixtureDir,
      relativePath: "scratch.ts",
      line: 4,
      textTarget: "unused",
    });

    expect(content).toContain(
      "Successfully deleted symbol from 1 file(s) with 1 occurrence(s)",
    );
    expect(content).toContain("scratch.ts");

    const scratch = await readFile(scratchPath, "utf-8");
    expect(scratch).not.toContain("unused");
    expect(scratch).toContain("export const value = newName();");
  });
});
