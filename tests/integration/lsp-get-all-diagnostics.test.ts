import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("lsp get all diagnostics", () => {
  let projectDir: string;
  let client: Client;
  let transport: StdioClientTransport;

  beforeEach(async () => {
    // Create a temporary test project
    projectDir = join(__dirname, `tmp-all-diagnostics-${Date.now()}`);
    await mkdir(projectDir, { recursive: true });

    // Create test files with various errors
    await writeFile(
      join(projectDir, "file1.ts"),
      `
      // Type error
      const x: string = 123;
      
      // Unused variable
      const unused = "test";
      `,
    );

    await writeFile(
      join(projectDir, "file2.ts"),
      `
      // Missing return
      function missingReturn(): string {
        console.log("no return");
      }
      
      // Type mismatch
      const arr: number[] = ["hello", "world"];
      `,
    );

    await writeFile(
      join(projectDir, "correct.ts"),
      `
      // This file has no errors
      export function add(a: number, b: number): number {
        return a + b;
      }
      `,
    );

    // Initialize git repo
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    await execAsync("git init", { cwd: projectDir });
    await execAsync("git add .", { cwd: projectDir });

    // Start MCP server with LSP
    transport = new StdioClientTransport({
      command: "node",
      args: [
        join(__dirname, "../../dist/lsmcp.js"),
        "--language",
        "typescript",
      ],
      cwd: projectDir,
      env: {
        ...process.env,
        FORCE_LSP: "true",
        LSP_COMMAND: join(
          __dirname,
          "../../node_modules/.bin/typescript-language-server",
        ) + " --stdio",
      },
    });

    client = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} },
    );

    await client.connect(transport);
  });

  afterEach(async () => {
    if (client) {
      await client.close();
    }
    if (projectDir) {
      await rm(projectDir, { recursive: true, force: true });
    }
  });

  it("should get diagnostics for all files", async () => {
    const result = await client.request({
      method: "tools/call",
      params: {
        name: "lsmcp_get_all_diagnostics",
        arguments: {
          root: projectDir,
          include: "**/*.ts",
          severityFilter: "all",
        },
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0]).toBeDefined();
    expect(result.content[0].type).toBe("text");

    const text = result.content[0].text;
    expect(text).toContain("errors");
    expect(text).toContain("warnings");
    expect(text).toContain("file1.ts");
    expect(text).toContain("file2.ts");
    expect(text).toContain("Type 'number' is not assignable to type 'string'");
  });

  it("should filter by severity", async () => {
    const result = await client.request({
      method: "tools/call",
      params: {
        name: "lsmcp_get_all_diagnostics",
        arguments: {
          root: projectDir,
          include: "**/*.ts",
          severityFilter: "error",
        },
      },
    });

    const text = result.content[0].text;
    expect(text).toContain("error");
    expect(text).not.toContain("warning");
  });

  it("should support include pattern", async () => {
    const result = await client.request({
      method: "tools/call",
      params: {
        name: "lsmcp_get_all_diagnostics",
        arguments: {
          root: projectDir,
          include: "**/file1.ts",
        },
      },
    });

    const text = result.content[0].text;
    expect(text).toContain("file1.ts");
    expect(text).not.toContain("file2.ts");
  });
});
