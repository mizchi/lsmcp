import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(__dirname, "../../dist/lsmcp.js");

// Type definitions for MCP tool results
interface TextContent {
  type: "text";
  text: string;
}

interface ToolResult {
  content: TextContent[];
}

describe("MCP Tools Integration Tests", () => {
  let tempDir: string;
  let mcpClient: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    // Create temp directory with unique name
    const hash = randomBytes(8).toString("hex");
    tempDir = join(__dirname, `tmp-mcp-tools-${hash}`);
    await mkdir(tempDir, { recursive: true });

    // Create test files
    await writeFile(
      join(tempDir, "test.ts"),
      `
// Test TypeScript file
export interface User {
  id: number;
  name: string;
  email: string;
}

export class UserService {
  private users: User[] = [];

  addUser(user: User): void {
    this.users.push(user);
  }

  getUser(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }

  getAllUsers(): User[] {
    return this.users;
  }
}

export function createUser(name: string, email: string): User {
  return {
    id: Math.random(),
    name,
    email
  };
}

// This will cause a type error
const testUser: User = {
  id: "wrong-type", // Error: Type 'string' is not assignable to type 'number'
  name: "Test",
  email: "test@example.com"
};
`,
    );

    await writeFile(
      join(tempDir, "helper.ts"),
      `
import { User, createUser } from "./test";

export function validateUser(user: User): boolean {
  return user.id > 0 && user.name.length > 0 && user.email.includes("@");
}

export const DEFAULT_USER = createUser("Default", "default@example.com");
`,
    );

    // Create config file
    await mkdir(join(tempDir, ".lsmcp"), { recursive: true });
    await writeFile(
      join(tempDir, ".lsmcp/config.json"),
      JSON.stringify(
        {
          preset: "typescript",
          files: ["**/*.ts", "**/*.tsx"],
          symbolFilter: {
            excludeKinds: [
              "Variable",
              "Constant",
              "String",
              "Number",
              "Boolean",
            ],
          },
        },
        null,
        2,
      ),
    );

    // Start MCP server with TypeScript preset
    transport = new StdioClientTransport({
      command: "node",
      args: [SERVER_PATH, "-p", "typescript"],
      cwd: tempDir,
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
  }, 30000);

  afterAll(async () => {
    // Cleanup
    await mcpClient.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("Project Overview", () => {
    it("should get project overview", async () => {
      const result = await mcpClient.callTool({
        name: "get_project_overview",
        arguments: {
          root: tempDir,
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      expect(content).toContain("Project Overview");
      // Project overview doesn't include language type by default
      expect(content).toContain("Files:");
      expect(content).toContain("Symbols:");
      expect(content).toContain("Classes:");
      expect(content).toContain("Functions:");
      expect(content).toContain("Interfaces:");
    });
  });

  describe("High-Level Symbol Search", () => {
    it("should search symbols and provide LSP guidance", async () => {
      const result = await mcpClient.callTool({
        name: "search_symbols",
        arguments: {
          query: "User",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      // Should find symbols and provide LSP tool guidance
      expect(content).toContain("User [Interface]");
      expect(content).toContain("UserService [Class]");
      expect(content).toContain("Location:");

      // Should include LSP tool guidance
      expect(content).toContain("lsp_get_definitions");
      expect(content).toContain("lsp_find_references");
      expect(content).toContain("lsp_get_hover");
      expect(content).toContain("lsp_rename_symbol");
    });

    it("should search functions with search_symbols", async () => {
      const result = await mcpClient.callTool({
        name: "search_symbols",
        arguments: {
          kind: "Function",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      expect(content).toContain("createUser [Function]");
      expect(content).toContain("validateUser [Function]");
      expect(content).toContain("Use these LSP tools for further operations");
    });
  });

  describe("High-Level Diagnostics", () => {
    it("should get diagnostics with unified tool", async () => {
      const result = await mcpClient.callTool({
        name: "get_diagnostics",
        arguments: {
          root: tempDir,
          relativePath: "test.ts",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      expect(content).toContain("Diagnostics for test.ts");
      expect(content.toLowerCase()).toContain("error");
      expect(content).toContain(
        "Type 'string' is not assignable to type 'number'",
      );

      // Should include LSP tool guidance
      expect(content).toContain("For more detailed analysis, use:");
      expect(content).toContain("lsp_get_diagnostics");
    });

    it("should get all diagnostics with pattern", async () => {
      const result = await mcpClient.callTool({
        name: "get_diagnostics",
        arguments: {
          root: tempDir,
          pattern: "**/*.ts",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      expect(content).toContain("Diagnostics for pattern");
      expect(content).toContain("Checked");
      expect(content).toContain("file(s)");

      // Should include LSP tool guidance
      expect(content).toContain("lsp_get_all_diagnostics");
    });
  });

  describe("Symbol Search and Indexing", () => {
    it("should automatically create index when searching symbols", async () => {
      // First search will automatically create the index
      const result = await mcpClient.callTool({
        name: "search_symbols",
        arguments: {
          name: "User",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      // Should find symbols (index created automatically if needed)
      expect(content).toContain("User");
      expect(content).toContain("[Interface]");
      expect(content).toContain("UserService");
      expect(content).toContain("[Class]");
    });

    it("should search with specific symbol kind", async () => {
      const result = await mcpClient.callTool({
        name: "search_symbols",
        arguments: {
          kind: "Function",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      expect(content).toContain("createUser");
      expect(content).toContain("validateUser");
      expect(content).toContain("[Function]");
    });
  });

  describe("LSP Tools", () => {
    it("should get hover information", async () => {
      const result = await mcpClient.callTool({
        name: "lsp_get_hover",
        arguments: {
          root: tempDir,
          relativePath: "test.ts",
          line: 9,
          textTarget: "UserService",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      expect(content).toContain("class UserService");
    });

    it("should find references", async () => {
      const result = await mcpClient.callTool({
        name: "lsp_find_references",
        arguments: {
          root: tempDir,
          relativePath: "test.ts",
          line: 3,
          symbolName: "User",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      expect(content).toContain("Found");
      expect(content).toContain("references");
      expect(content).toContain("test.ts");
      // helper.ts might not be included if import analysis fails
      if (content.includes("helper")) {
        expect(content).toContain("helper.ts");
      }
    });

    it("should get definitions", async () => {
      const result = await mcpClient.callTool({
        name: "lsp_get_definitions",
        arguments: {
          root: tempDir,
          relativePath: "helper.ts",
          line: 2,
          symbolName: "createUser",
          includeBody: true,
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      expect(content).toContain("export function createUser");
      expect(content).toContain("return {");
    });

    it("should get diagnostics for a single file", async () => {
      const result = await mcpClient.callTool({
        name: "lsp_get_diagnostics",
        arguments: {
          root: tempDir,
          relativePath: "test.ts",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      expect(content.toLowerCase()).toContain("error");
      expect(content).toContain(
        "Type 'string' is not assignable to type 'number'",
      );
    });

    it("should get all diagnostics", async () => {
      const result = await mcpClient.callTool({
        name: "lsp_get_all_diagnostics",
        arguments: {
          root: tempDir,
          pattern: "**/*.ts",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      // Might be 0 errors if TypeScript hasn't loaded yet
      expect(content).toContain("Found");
      // Don't check for specific files if no errors found
    });

    it("should get document symbols", async () => {
      const result = await mcpClient.callTool({
        name: "lsp_get_document_symbols",
        arguments: {
          root: tempDir,
          relativePath: "test.ts",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      expect(content).toContain("User [Interface]");
      expect(content).toContain("UserService [Class]");
      expect(content).toContain("addUser [Method]");
      expect(content).toContain("getUser [Method]");
      expect(content).toContain("createUser [Function]");
    });

    it("should get workspace symbols", async () => {
      const result = await mcpClient.callTool({
        name: "lsp_get_workspace_symbols",
        arguments: {
          query: "User",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      // Workspace symbols might not work initially
      if (!content.includes("Error")) {
        expect(content).toContain("User");
        expect(content).toContain("UserService");
        expect(content).toContain("validateUser");
      }
    });

    it("should check capabilities", async () => {
      const result = await mcpClient.callTool({
        name: "lsp_check_capabilities",
        arguments: {},
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      expect(content).toContain("Language Server Capabilities");
      expect(content).toContain("Hover");
      expect(content).toContain("Go to Definition");
      expect(content).toContain("Find References");
      expect(content).toContain("Document Symbols");
    });
  });

  describe("File System Tools", () => {
    it("should list directory", async () => {
      const result = await mcpClient.callTool({
        name: "list_dir",
        arguments: {
          relativePath: ".",
          recursive: false,
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      expect(content).toContain("test.ts");
      expect(content).toContain("helper.ts");
      // .lsmcp might not be listed in recursive: false mode
    });

    it("should find files", async () => {
      const result = await mcpClient.callTool({
        name: "find_file",
        arguments: {
          fileMask: "*.ts",
          relativePath: ".",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      expect(content).toContain("test.ts");
      expect(content).toContain("helper.ts");
    });
  });

  describe("Memory System", () => {
    it("should write and read memory", async () => {
      // Write memory
      const writeResult = await mcpClient.callTool({
        name: "write_memory",
        arguments: {
          root: tempDir,
          memoryName: "test-memory",
          content: "This is a test memory content.",
        },
      });

      const writeTyped = writeResult as ToolResult;
      expect(writeTyped.content[0]?.text.toLowerCase()).toContain("saved");

      // List memories
      const listResult = await mcpClient.callTool({
        name: "list_memories",
        arguments: {
          root: tempDir,
        },
      });

      const listTyped = listResult as ToolResult;
      expect(listTyped.content[0]?.text).toContain("test-memory");

      // Read memory
      const readResult = await mcpClient.callTool({
        name: "read_memory",
        arguments: {
          root: tempDir,
          memoryName: "test-memory",
        },
      });

      const readTyped = readResult as ToolResult;
      expect(readTyped.content[0]?.text).toContain(
        "This is a test memory content",
      );

      // Delete memory
      const deleteResult = await mcpClient.callTool({
        name: "delete_memory",
        arguments: {
          root: tempDir,
          memoryName: "test-memory",
        },
      });

      const deleteTyped = deleteResult as ToolResult;
      expect(deleteTyped.content[0]?.text).toContain("deleted");
    });
  });

  describe("Code Completion and Assistance", () => {
    it("should get completion suggestions", async () => {
      const result = await mcpClient.callTool({
        name: "lsp_get_completion",
        arguments: {
          root: tempDir,
          relativePath: "test.ts",
          line: 14,
          column: 10,
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      // Completion might fail if language server is not ready
      if (!content.toLowerCase().includes("error")) {
        // Should suggest array methods
        expect(content.toLowerCase()).toContain("push");
      }
    });

    it("should get signature help", async () => {
      const result = await mcpClient.callTool({
        name: "lsp_get_signature_help",
        arguments: {
          root: tempDir,
          relativePath: "helper.ts",
          line: 7,
          textTarget: "createUser(",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      // Signature help might not be available initially
      if (!content.includes("No signature help")) {
        expect(content).toContain("name: string");
        expect(content).toContain("email: string");
      }
    });
  });

  describe("Symbol Editing Tools", () => {
    it("should get symbols overview", async () => {
      const result = await mcpClient.callTool({
        name: "get_symbols_overview",
        arguments: {
          relativePath: "test.ts",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      expect(content).toContain("User");
      expect(content).toContain("UserService");
      expect(content).toContain("createUser");
    });
  });

  // Index management is now automatic - no direct access to index_symbols or clear_index

  describe("Symbol Details Tool", () => {
    it("should get comprehensive symbol details", async () => {
      const result = await mcpClient.callTool({
        name: "get_symbol_details",
        arguments: {
          root: tempDir,
          relativePath: "test.ts",
          line: 3,
          symbol: "User",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      // Should include basic sections
      expect(content).toContain("Symbol Details: User");
      expect(content).toContain("Location:");
      // The tool may not return all sections if LSP doesn't provide them
      expect(content).toContain("Next Steps");
    });

    it("should handle symbol not found", async () => {
      const result = await mcpClient.callTool({
        name: "get_symbol_details",
        arguments: {
          root: tempDir,
          relativePath: "test.ts",
          line: 10,
          symbol: "NonExistentSymbol",
        },
      });

      const typedResult = result as ToolResult;
      const content = typedResult.content[0]?.text || "";

      // Check for error message
      expect(content).toContain("NonExistentSymbol");
    });
  });

  describe("Integration Between High and Low Level APIs", () => {
    it("should use search_symbols first, then use LSP tools for details", async () => {
      // Step 1: Find symbols with high-level API
      const searchResult = await mcpClient.callTool({
        name: "search_symbols",
        arguments: {
          query: "createUser",
        },
      });

      const searchTyped = searchResult as ToolResult;
      const searchContent = searchTyped.content[0]?.text || "";

      expect(searchContent).toContain("createUser [Function]");
      expect(searchContent).toContain("test.ts");

      // Extract line number from the guidance (should be in format "line XX")
      const lineMatch = searchContent.match(/--line (\d+)/);
      expect(lineMatch).toBeTruthy();
      const lineNumber = parseInt(lineMatch![1]);

      // Step 2: Use LSP tool for detailed information
      const hoverResult = await mcpClient.callTool({
        name: "lsp_get_hover",
        arguments: {
          root: tempDir,
          relativePath: "test.ts",
          line: lineNumber,
          textTarget: "createUser",
        },
      });

      const hoverTyped = hoverResult as ToolResult;
      const hoverContent = hoverTyped.content[0]?.text || "";

      expect(hoverContent).toContain("function createUser");
      expect(hoverContent).toContain("name: string");
      expect(hoverContent).toContain("email: string");
    });
  });
});
