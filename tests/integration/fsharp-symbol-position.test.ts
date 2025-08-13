import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(__dirname, "../../dist/lsmcp.js");

describe("F# Symbol Position with Comments", () => {
  let tempDir: string;
  let mcpClient: Client;
  let transport: StdioClientTransport;

  beforeEach(async () => {
    // Create temp directory
    const hash = randomBytes(8).toString("hex");
    tempDir = join(__dirname, `tmp-fsharp-${hash}`);
    await mkdir(tempDir, { recursive: true });

    // Create F# test file with comments
    const testFile = `module TestModule

/// This is a document comment for the function
/// It spans multiple lines to test position handling
let myFunction x =
    x + 1

/// Another comment for a type
type MyType = {
    /// Field comment
    Value: int
    /// Another field comment
    Name: string
}

/// Comment for a class
type MyClass() =
    /// Method comment
    member this.GetValue() = 42
    
    /// Property comment
    member this.Property = "test"
`;

    await writeFile(join(tempDir, "test.fs"), testFile);

    // Create F# project file
    await writeFile(
      join(tempDir, "test.fsproj"),
      `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="test.fs" />
  </ItemGroup>
</Project>`,
    );

    // Start MCP server with F# support
    transport = new StdioClientTransport({
      command: "node",
      args: [SERVER_PATH, "-p", "fsharp"],
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

  it("should return correct symbol position ignoring document comments", async () => {
    // Index the F# file
    await mcpClient.callTool({
      name: "index_symbols",
      arguments: {
        root: tempDir,
        pattern: "**/*.fs",
      },
    });

    // Search for the function
    const searchResult = await mcpClient.callTool({
      name: "search_symbol_from_index",
      arguments: {
        root: tempDir,
        name: "myFunction",
        kind: "Function",
      },
    });

    const resultText = (searchResult.content as any)[0]?.text || "";

    // The function should be at line 5 (1-indexed), not at the comment line
    expect(resultText).toContain("myFunction");
    expect(resultText).toMatch(/test\.fs:5:\d+/); // Line 5 is where "let myFunction" is

    // Now test get_definitions to ensure it works correctly
    const definitionResult = await mcpClient.callTool({
      name: "get_definitions",
      arguments: {
        root: tempDir,
        filePath: "test.fs",
        line: 5, // The actual function line, not the comment
        symbolName: "myFunction",
      },
    });

    expect(definitionResult.content).toBeDefined();
    const defText = (definitionResult.content as any)[0]?.text || "";
    expect(defText).toContain("myFunction");
  }, 30000);

  it("should return correct position for type definitions with comments", async () => {
    // Index the F# file
    await mcpClient.callTool({
      name: "index_symbols",
      arguments: {
        root: tempDir,
        pattern: "**/*.fs",
      },
    });

    // Search for the type
    const searchResult = await mcpClient.callTool({
      name: "search_symbol_from_index",
      arguments: {
        root: tempDir,
        name: "MyType",
        kind: "Class", // F# types may be reported as Class
      },
    });

    const resultText = (searchResult.content as any)[0]?.text || "";

    // The type should be at line 9, not at the comment line
    expect(resultText).toContain("MyType");
    // Check if it's not pointing to the comment line (8)
    expect(resultText).not.toMatch(/test\.fs:8:\d+/);
  }, 30000);

  it("should return correct position for class members with comments", async () => {
    // Index the F# file
    await mcpClient.callTool({
      name: "index_symbols",
      arguments: {
        root: tempDir,
        pattern: "**/*.fs",
      },
    });

    // Search for the method
    const searchResult = await mcpClient.callTool({
      name: "search_symbol_from_index",
      arguments: {
        root: tempDir,
        name: "GetValue",
        kind: "Method",
      },
    });

    const resultText = (searchResult.content as any)[0]?.text || "";

    // The method should be at line 19, not at the comment line
    expect(resultText).toContain("GetValue");
    expect(resultText).toMatch(/test\.fs:19:\d+/); // Line 19 is where the method is
  }, 30000);
});
