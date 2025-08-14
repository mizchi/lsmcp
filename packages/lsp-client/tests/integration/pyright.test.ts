/**
 * Integration tests for Pyright Language Server
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import { existsSync, promises as fs } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("Pyright Language Server Integration", () => {
  let client: Client;
  let lspProcess: ReturnType<typeof spawn>;
  let tmpDir: string;

  beforeAll(async () => {
    // Create a temporary directory for test files
    tmpDir = await mkdtemp(join(tmpdir(), "pyright-test-"));
    
    // Create test Python files with intentional errors
    await writeFile(
      join(tmpDir, "test_errors.py"),
      `# Test file with type errors
import typing

def add_numbers(a: int, b: int) -> int:
    return a + b

# Type error: passing string to function expecting int
result = add_numbers(1, "2")

# Undefined variable error
print(undefined_variable)

# Type annotation error
wrong_type: int = "this is a string"

# Missing import
import nonexistent_module
`
    );

    await writeFile(
      join(tmpDir, "test_clean.py"),
      `# Test file without errors
def greet(name: str) -> str:
    return f"Hello, {name}!"

message = greet("World")
print(message)
`
    );

    // Create pyproject.toml for Pyright configuration
    await writeFile(
      join(tmpDir, "pyproject.toml"),
      `[tool.pyright]
include = ["*.py"]
reportMissingImports = true
reportUndefinedVariable = true
reportGeneralTypeIssues = true
pythonVersion = "3.9"
`
    );

    // Start the LSMCP server with Pyright preset
    const lsmcpPath = join(__dirname, "../../../../src/cli/lsmcp.ts");
    
    lspProcess = spawn(
      "node",
      [lsmcpPath, "--preset", "pyright"],
      {
        cwd: tmpDir,
        env: {
          ...process.env,
          DEBUG: "lsmcp:*",
        },
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    // Wait for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Create MCP client
    const transport = new StdioClientTransport({
      command: "node",
      args: [lsmcpPath, "--preset", "pyright"],
      env: {
        ...process.env,
        DEBUG: "lsmcp:*",
      },
      workingDirectory: tmpDir,
    });

    client = new Client(
      {
        name: "pyright-test-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);
  });

  afterAll(async () => {
    if (client) {
      await client.close();
    }
    if (lspProcess && !lspProcess.killed) {
      lspProcess.kill();
    }
    // Clean up temp directory
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Diagnostics", () => {
    it("should detect type errors in Python code", async () => {
      const result = await client.request(
        {
          method: "mcp__lsmcp__get_diagnostics",
          params: {
            root: tmpDir,
            filePath: "test_errors.py",
            forceRefresh: true,
            timeout: 10000,
          },
        },
        {}
      );

      expect(result).toBeDefined();
      expect(typeof result.content[0].text).toBe("string");
      
      const diagnosticsText = result.content[0].text;
      
      // Should detect type error for wrong argument type
      expect(diagnosticsText).toContain("Argument of type");
      expect(diagnosticsText).toContain('"2"');
      
      // Should detect undefined variable
      expect(diagnosticsText).toContain("undefined_variable");
      
      // Should detect type annotation mismatch
      expect(diagnosticsText).toContain("wrong_type");
      
      // Should detect missing import
      expect(diagnosticsText).toContain("nonexistent_module");
    }, 15000);

    it("should report no errors for clean Python code", async () => {
      const result = await client.request(
        {
          method: "mcp__lsmcp__get_diagnostics",
          params: {
            root: tmpDir,
            filePath: "test_clean.py",
            forceRefresh: true,
            timeout: 10000,
          },
        },
        {}
      );

      expect(result).toBeDefined();
      expect(typeof result.content[0].text).toBe("string");
      
      const diagnosticsText = result.content[0].text;
      
      // Should report no errors
      expect(diagnosticsText).toContain("0 error");
      expect(diagnosticsText).toContain("0 warning");
    }, 15000);

    it("should get all diagnostics for project", async () => {
      const result = await client.request(
        {
          method: "mcp__lsmcp__get_all_diagnostics",
          params: {
            root: tmpDir,
            pattern: "**/*.py",
            severityFilter: "all",
          },
        },
        {}
      );

      expect(result).toBeDefined();
      expect(typeof result.content[0].text).toBe("string");
      
      const diagnosticsText = result.content[0].text;
      
      // Should include diagnostics from test_errors.py
      expect(diagnosticsText).toContain("test_errors.py");
      
      // Should show summary of errors
      expect(diagnosticsText).toMatch(/\d+ diagnostic\(s\) found/);
    }, 20000);
  });

  describe("Hover Information", () => {
    it("should provide hover information for Python symbols", async () => {
      const result = await client.request(
        {
          method: "mcp__lsmcp__get_hover",
          params: {
            root: tmpDir,
            filePath: "test_clean.py",
            line: 2,
            target: "greet",
          },
        },
        {}
      );

      expect(result).toBeDefined();
      expect(typeof result.content[0].text).toBe("string");
      
      const hoverText = result.content[0].text;
      
      // Should show function signature
      expect(hoverText).toContain("def greet");
      expect(hoverText).toContain("str");
    });
  });

  describe("Definitions", () => {
    it("should find function definitions", async () => {
      const result = await client.request(
        {
          method: "mcp__lsmcp__get_definitions",
          params: {
            root: tmpDir,
            filePath: "test_clean.py",
            line: 5,
            symbolName: "greet",
          },
        },
        {}
      );

      expect(result).toBeDefined();
      expect(typeof result.content[0].text).toBe("string");
      
      const definitionText = result.content[0].text;
      
      // Should find the function definition
      expect(definitionText).toContain("def greet");
      expect(definitionText).toContain("test_clean.py");
    });
  });

  describe("Document Symbols", () => {
    it("should list all symbols in a Python file", async () => {
      const result = await client.request(
        {
          method: "mcp__lsmcp__get_document_symbols",
          params: {
            root: tmpDir,
            filePath: "test_errors.py",
          },
        },
        {}
      );

      expect(result).toBeDefined();
      expect(typeof result.content[0].text).toBe("string");
      
      const symbolsText = result.content[0].text;
      
      // Should list function symbols
      expect(symbolsText).toContain("add_numbers");
      expect(symbolsText).toContain("Function");
      
      // Should list variable symbols
      expect(symbolsText).toContain("result");
      expect(symbolsText).toContain("wrong_type");
    });
  });

  describe("Completion", () => {
    it("should provide code completions for Python", async () => {
      // Add a test file with incomplete code
      await writeFile(
        join(tmpDir, "test_completion.py"),
        `import typing

def test_function():
    pass

test_`
      );

      const result = await client.request(
        {
          method: "mcp__lsmcp__get_completion",
          params: {
            root: tmpDir,
            filePath: "test_completion.py",
            line: 6,
            target: "test_",
          },
        },
        {}
      );

      expect(result).toBeDefined();
      expect(typeof result.content[0].text).toBe("string");
      
      const completionText = result.content[0].text;
      
      // Should suggest test_function
      expect(completionText).toContain("test_function");
    });
  });
});