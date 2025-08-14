import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

describe("get_project_overview for all languages", () => {
  let mcpClient: Client;

  beforeAll(async () => {
    // Create MCP client
    const transport = new StdioClientTransport({
      command: "node",
      args: [join(projectRoot, "dist/lsmcp.js"), "--preset", "typescript"],
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
  });

  afterAll(async () => {
    if (mcpClient) {
      await mcpClient.close();
    }
  });

  const testCases = [
    {
      name: "TypeScript",
      fixture: "typescript",
      expectedTypes: ["Interface", "Function", "Class", "Variable"],
      skipInCI: false,
    },
    {
      name: "Python",
      fixture: "python",
      expectedTypes: ["Function", "Class", "Variable"],
      skipInCI:
        !existsSync("/usr/bin/pyright") &&
        !existsSync("/usr/local/bin/pyright"),
    },
    {
      name: "Rust",
      fixture: "rust",
      expectedTypes: ["Function", "Struct"],
      skipInCI:
        !existsSync("/usr/bin/rust-analyzer") &&
        !existsSync("/usr/local/bin/rust-analyzer"),
    },
    {
      name: "Go",
      fixture: "go",
      expectedTypes: ["Function", "Struct"],
      skipInCI:
        !existsSync("/usr/bin/gopls") && !existsSync("/usr/local/bin/gopls"),
    },
    {
      name: "F#",
      fixture: "fsharp",
      expectedTypes: ["Function", "Module"],
      skipInCI:
        !existsSync("/usr/bin/fsautocomplete") &&
        !existsSync("/usr/local/bin/fsautocomplete"),
    },
    {
      name: "Ruby",
      fixture: "ruby",
      expectedTypes: ["Class", "Method", "Module"],
      skipInCI:
        !existsSync("/usr/bin/solargraph") &&
        !existsSync("/usr/local/bin/solargraph"),
    },
  ];

  for (const testCase of testCases) {
    const testFn = testCase.skipInCI ? it.skip : it;

    testFn(`should get project overview for ${testCase.name}`, async () => {
      const fixtureRoot = join(__dirname, "../fixtures", testCase.fixture);

      // Call get_project_overview tool
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

      // Basic assertions
      expect(content).toContain("## Project Overview");
      expect(content).toContain("### Statistics");
      expect(content).toContain("### Key Components");

      // Check for expected symbol types
      for (const expectedType of testCase.expectedTypes) {
        expect(content.toLowerCase()).toContain(expectedType.toLowerCase());
      }

      // Language-specific checks
      if (testCase.name === "TypeScript") {
        expect(content).toContain(".ts");
      } else if (testCase.name === "Rust") {
        expect(content).toContain(".rs");
      } else if (testCase.name === "Python") {
        expect(content).toContain(".py");
      } else if (testCase.name === "F#") {
        expect(content).toContain(".fs");
      } else if (testCase.name === "Go") {
        expect(content).toContain(".go");
      } else if (testCase.name === "Ruby") {
        expect(content).toContain(".rb");
      }
    });
  }
});
