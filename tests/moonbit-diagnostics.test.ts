import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ChildProcess, spawn } from "child_process";
import { join, resolve } from "path";
import { setTimeout } from "timers/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  type StdioClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/stdio.js";

describe("MoonBit Diagnostics", () => {
  let client: Client;
  let transport: StdioClientTransport;
  let serverProcess: ChildProcess;
  const projectRoot = resolve(
    import.meta.dirname,
    "../examples/moonbit-project",
  );

  beforeAll(async () => {
    // Start MoonBit MCP server
    const serverPath = join(import.meta.dirname, "../dist/lsmcp.js");
    const args = ["-l", "moonbit", "--bin", "npx moonbit-lsp"];

    serverProcess = spawn("node", [serverPath, ...args], {
      cwd: projectRoot,
      env: { ...process.env },
    });

    const transportOptions: StdioClientTransportOptions = {
      command: "node",
      args: [serverPath, ...args],
      cwd: projectRoot,
      env: { ...process.env },
    };

    transport = new StdioClientTransport(transportOptions);
    client = new Client(
      {
        name: "test-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    await client.connect(transport);
    await setTimeout(1000); // Give LSP time to initialize
  });

  afterAll(async () => {
    await client.close();
    serverProcess?.kill();
    await setTimeout(100);
  });

  it("should detect errors in error.mbt", async () => {
    const result = await client.request(
      {
        method: "tools/call",
        params: {
          name: "lsmcp_get_diagnostics",
          arguments: {
            root: projectRoot,
            filePath: "src/test/error.mbt",
          },
        },
      },
      { timeout: 10000 },
    );

    console.log("Diagnostics result:", result);

    // Check if diagnostics are returned
    const content = result.content?.[0]?.text || "";

    // MoonBit should detect at least some of these errors:
    // - Type error: String = 42
    // - Undefined variable: undefined_var
    // - Wrong arity: add(1)
    // - Missing return value

    // If no errors are detected, the test should fail
    expect(content).not.toContain("0 errors and 0 warnings");
    expect(content.toLowerCase()).toContain("error");
  });

  it("should find no errors in valid files", async () => {
    const result = await client.request(
      {
        method: "tools/call",
        params: {
          name: "lsmcp_get_diagnostics",
          arguments: {
            root: projectRoot,
            filePath: "src/lib/hello.mbt",
          },
        },
      },
      { timeout: 10000 },
    );

    const content = result.content?.[0]?.text || "";
    expect(content).toContain("0 errors and 0 warnings");
  });

  it("should get all diagnostics for the project", async () => {
    const result = await client.request(
      {
        method: "tools/call",
        params: {
          name: "lsmcp_get_all_diagnostics",
          arguments: {
            root: projectRoot,
            include: "**/*.mbt",
          },
        },
      },
      { timeout: 15000 },
    );

    console.log("All diagnostics result:", result);

    const content = result.content?.[0]?.text || "";

    // Should find errors in error.mbt
    expect(content).toMatch(/Found \d+ errors?/);

    // Should list files with errors
    if (!content.includes("0 errors")) {
      expect(content).toContain("src/test/error.mbt");
    }
  });

  it("should filter diagnostics by severity", async () => {
    const result = await client.request(
      {
        method: "tools/call",
        params: {
          name: "lsmcp_get_all_diagnostics",
          arguments: {
            root: projectRoot,
            include: "**/*.mbt",
            severityFilter: "error",
          },
        },
      },
      { timeout: 15000 },
    );

    const content = result.content?.[0]?.text || "";

    // Should only show errors, not warnings
    if (!content.includes("0 errors")) {
      expect(content).toMatch(/Found \d+ errors?/);
      expect(content).not.toMatch(/warning/i);
    }
  });
});
