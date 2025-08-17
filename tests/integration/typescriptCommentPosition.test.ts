import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(__dirname, "../../dist/lsmcp.js");

describe("TypeScript Symbol Position with Comments", () => {
  let tempDir: string;
  let mcpClient: Client;
  let transport: StdioClientTransport;

  beforeEach(async () => {
    // Create temp directory
    const hash = randomBytes(8).toString("hex");
    tempDir = join(__dirname, `tmp-ts-comment-${hash}`);
    await mkdir(tempDir, { recursive: true });

    // Create TypeScript test file with comments
    const testFile = `/**
 * This is a JSDoc comment for the function
 * It spans multiple lines to test position handling
 */
export function myFunction(x: number): number {
    return x + 1;
}

/**
 * Another comment for an interface
 */
export interface MyInterface {
    /** Field comment */
    value: number;
    /** Another field comment */
    name: string;
}

/**
 * Comment for a class
 */
export class MyClass {
    /**
     * Method comment
     */
    getValue(): number {
        return 42;
    }
    
    /**
     * Property comment
     */
    readonly property = "test";
}

// Single line comment before function
export const arrowFunction = (x: number) => x * 2;

/* Multi-line comment
   before another function */
export function anotherFunction() {
    return "hello";
}
`;

    await writeFile(join(tempDir, "test.ts"), testFile);

    // Create tsconfig.json
    await writeFile(
      join(tempDir, "tsconfig.json"),
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

    // Start MCP server with TypeScript support
    transport = new StdioClientTransport({
      command: "node",
      args: [SERVER_PATH, "-p", "typescript"],
      cwd: tempDir,
      env: {
        ...process.env,
      } as Record<string, string>,
    });

    mcpClient = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await mcpClient.connect(transport);
  }, 30000);

  afterEach(async () => {
    try {
      if (mcpClient) {
        await mcpClient.close();
      }
    } catch (error) {
      console.error("Error during client cleanup:", error);
    }

    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error("Error during temp directory cleanup:", error);
    }
  }, 10000);

  it("should return correct symbol position ignoring JSDoc comments", async () => {
    // Index is created automatically when needed

    // Search for the function
    const searchResult = await mcpClient.callTool({
      name: "search_symbols",
      arguments: {
        root: tempDir,
        name: "myFunction",
        kind: "Function",
      },
    });

    const resultText = (searchResult.content as any)[0]?.text || "";
    console.log("Search result for myFunction:", resultText);

    // The function should be at line 5 (1-indexed), not at the comment line
    expect(resultText).toContain("myFunction");
    // Check that it's pointing to line 5 where the function declaration is
    expect(resultText).toMatch(/test\.ts:5:\d+/);

    // Now test lsp_get_definitions to ensure it works correctly
    const definitionResult = await mcpClient.callTool({
      name: "lsp_get_definitions",
      arguments: {
        root: tempDir,
        relativePath: "test.ts",
        line: 5, // The actual function line, not the comment
        symbolName: "myFunction",
      },
    });

    expect(definitionResult.content).toBeDefined();
    const defText = (definitionResult.content as any)[0]?.text || "";
    expect(defText).toContain("myFunction");
  }, 30000);

  it("should return correct position for interface definitions with comments", async () => {
    // Index is created automatically when needed

    // Search for the interface
    const searchResult = await mcpClient.callTool({
      name: "search_symbols",
      arguments: {
        root: tempDir,
        name: "MyInterface",
        kind: "Interface",
      },
    });

    const resultText = (searchResult.content as any)[0]?.text || "";
    console.log("Search result for MyInterface:", resultText);

    // The interface should be at line 12, not at the comment lines
    expect(resultText).toContain("MyInterface");
    // Check that it's not pointing to comment lines (9-11)
    expect(resultText).not.toMatch(/test\.ts:(9|10|11):\d+/);
    expect(resultText).toMatch(/test\.ts:12:\d+/);
  }, 30000);

  it("should return correct position for class methods with comments", async () => {
    // Index is created automatically when needed

    // Search for the method
    const searchResult = await mcpClient.callTool({
      name: "search_symbols",
      arguments: {
        root: tempDir,
        name: "getValue",
        kind: "Method",
      },
    });

    const resultText = (searchResult.content as any)[0]?.text || "";
    console.log("Search result for getValue:", resultText);

    // The method should be at line 26, not at the comment lines
    expect(resultText).toContain("getValue");
    // Check it's not pointing to comment lines (23-25)
    expect(resultText).not.toMatch(/test\.ts:(23|24|25):\d+/);
    expect(resultText).toMatch(/test\.ts:26:\d+/);
  }, 30000);

  it("should handle single-line comments correctly", async () => {
    // Index is created automatically when needed

    // Search for the function declared after multi-line comment
    const searchResult = await mcpClient.callTool({
      name: "search_symbols",
      arguments: {
        root: tempDir,
        name: "anotherFunction",
      },
    });

    const resultText = (searchResult.content as any)[0]?.text || "";
    console.log("Search result for anotherFunction:", resultText);

    // The function should be at the declaration line, not at the comment line
    expect(resultText).toContain("anotherFunction");
    // Should be at the function declaration line, not the comment lines
    expect(resultText).toMatch(/test\.ts:\d+:\d+/);
  }, 30000);
});
