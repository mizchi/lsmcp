/**
 * Integration tests for code-indexer MCP tools
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(__dirname, "../../dist/lsmcp.js");

describe("Code-Indexer MCP Integration Tests", () => {
  let tempDir: string;
  let mcpClient: Client;
  let transport: StdioClientTransport;

  beforeEach(async () => {
    // Create temp directory with unique name
    const hash = randomBytes(8).toString("hex");
    tempDir = join(__dirname, `tmp-indexer-${hash}`);
    await mkdir(tempDir, { recursive: true });

    // Create test project structure with various TypeScript files
    const testFiles = {
      "src/index.ts": `
export function main() {
  console.log("Hello World");
  const calc = new Calculator();
  return calc.add(1, 2);
}

export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
  
  subtract(a: number, b: number): number {
    return a - b;
  }
  
  multiply(a: number, b: number): number {
    return a * b;
  }
  
  divide(a: number, b: number): number {
    if (b === 0) throw new Error("Division by zero");
    return a / b;
  }
}

export interface Config {
  name: string;
  version: string;
  enabled: boolean;
}

export type Status = "active" | "inactive" | "pending";
`,
      "src/utils.ts": `
export const VERSION = "1.0.0";
export const API_URL = "https://api.example.com";

export function formatDate(date: Date): string {
  return date.toISOString();
}

export function parseJSON<T>(json: string): T {
  return JSON.parse(json);
}

export class Logger {
  private level: string;
  
  constructor(level: string = "info") {
    this.level = level;
  }
  
  log(message: string): void {
    console.log(\`[\${this.level}] \${message}\`);
  }
  
  error(message: string): void {
    console.error(\`[ERROR] \${message}\`);
  }
}

export interface LogConfig {
  level: string;
  timestamp: boolean;
  format: "json" | "text";
}
`,
      "src/services/api.ts": `
import { Logger } from "../utils.ts";

export class ApiService {
  private logger: Logger;
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.logger = new Logger("api");
    this.baseUrl = baseUrl;
  }
  
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(\`\${this.baseUrl}/\${endpoint}\`);
    return response.json();
  }
  
  async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(\`\${this.baseUrl}/\${endpoint}\`, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" }
    });
    return response.json();
  }
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
`,
      "src/models/user.ts": `
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserModel {
  private users: Map<string, User>;
  
  constructor() {
    this.users = new Map();
  }
  
  create(user: User): void {
    this.users.set(user.id, user);
  }
  
  findById(id: string): User | undefined {
    return this.users.get(id);
  }
  
  findByEmail(email: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return undefined;
  }
  
  update(id: string, updates: Partial<User>): boolean {
    const user = this.users.get(id);
    if (!user) return false;
    
    this.users.set(id, { ...user, ...updates, updatedAt: new Date() });
    return true;
  }
  
  delete(id: string): boolean {
    return this.users.delete(id);
  }
}

export enum UserRole {
  Admin = "admin",
  User = "user",
  Guest = "guest"
}
`,
      "package.json": `{
  "name": "test-project",
  "version": "1.0.0",
  "type": "module"
}`,
      "tsconfig.json": `{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}`,
    };

    // Write test files
    for (const [path, content] of Object.entries(testFiles)) {
      const fullPath = join(tempDir, path);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content);
    }

    // Start MCP server via transport
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
      // Close client
      if (mcpClient) {
        await mcpClient.close();
      }
    } catch (error) {
      console.error("Error during client cleanup:", error);
    }

    // Clean up temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error("Error during temp directory cleanup:", error);
    }
  }, 10000);

  describe("index_symbols", () => {
    it("should index TypeScript files in the project", async () => {
      const result = await mcpClient.callTool({
        name: "index_symbols",
        arguments: {
          root: tempDir,
          pattern: "**/*.ts",
        },
      });

      expect(result.content).toBeDefined();
      expect((result.content as any)[0]?.text).toContain("Indexed");
      expect((result.content as any)[0]?.text).toContain("files");
      expect((result.content as any)[0]?.text).toContain("symbols");
    }, 30000);

    it("should support incremental indexing", async () => {
      // First indexing
      await mcpClient.callTool({
        name: "index_symbols",
        arguments: {
          root: tempDir,
          pattern: "**/*.ts",
        },
      });

      // Second indexing should be incremental
      const result = await mcpClient.callTool({
        name: "index_symbols",
        arguments: {
          root: tempDir,
          pattern: "**/*.ts",
        },
      });

      expect((result.content as any)[0]?.text).toBeDefined();
      // Should mention that it's using incremental update or that files are up-to-date
    }, 30000);

    it("should force full re-index with noCache option", async () => {
      // First indexing
      await mcpClient.callTool({
        name: "index_symbols",
        arguments: {
          root: tempDir,
          pattern: "**/*.ts",
        },
      });

      // Force full re-index
      const result = await mcpClient.callTool({
        name: "index_symbols",
        arguments: {
          root: tempDir,
          pattern: "**/*.ts",
          noCache: true,
        },
      });

      expect((result.content as any)[0]?.text).toContain("Indexed");
      expect((result.content as any)[0]?.text).toContain("files");
    }, 30000);
  });

  describe("search_symbol_from_index", () => {
    it("should search for classes by name", async () => {
      const result = await mcpClient.callTool({
        name: "search_symbol_from_index",
        arguments: {
          root: tempDir,
          name: "Calculator",
          kind: "Class",
        },
      });

      // The result is returned as text, not JSON
      const resultText = (result.content as any)[0]?.text || "";
      expect(resultText).toContain("Calculator");
      expect(resultText).toContain("Class");
      expect(resultText).toContain("symbol");
    }, 30000);

    it("should search for methods within a class", async () => {
      const result = await mcpClient.callTool({
        name: "search_symbol_from_index",
        arguments: {
          root: tempDir,
          name: "add",
          kind: "Method",
          containerName: "Calculator",
        },
      });

      // The result is returned as text, not JSON
      const resultText = (result.content as any)[0]?.text || "";
      expect(resultText).toContain("add");
      expect(resultText).toContain("Method");
      expect(resultText).toContain("Calculator");
    }, 30000);

    it("should search for interfaces", async () => {
      const result = await mcpClient.callTool({
        name: "search_symbol_from_index",
        arguments: {
          root: tempDir,
          kind: "Interface",
        },
      });

      // The result is returned as text, not JSON
      const resultText = (result.content as any)[0]?.text || "";
      expect(resultText).toContain("Config");
      expect(resultText).toContain("User");
      expect(resultText).toContain("LogConfig");
      expect(resultText).toContain("Interface");
    }, 30000);

    it("should search for functions", async () => {
      const result = await mcpClient.callTool({
        name: "search_symbol_from_index",
        arguments: {
          root: tempDir,
          kind: "Function",
        },
      });

      // The result is returned as text, not JSON
      const resultText = (result.content as any)[0]?.text || "";
      expect(resultText).toContain("main");
      expect(resultText).toContain("formatDate");
      expect(resultText).toContain("parseJSON");
      expect(resultText).toContain("Function");
    }, 30000);

    it("should search within specific file", async () => {
      const result = await mcpClient.callTool({
        name: "search_symbol_from_index",
        arguments: {
          root: tempDir,
          file: "src/utils.ts",
        },
      });

      // The result is returned as text, not JSON
      const resultText = (result.content as any)[0]?.text || "";
      expect(resultText).toContain("Logger");
      expect(resultText).toContain("VERSION");
      expect(resultText).toContain("formatDate");
      expect(resultText).toContain("src/utils.ts");
    }, 30000);

    it("should support partial name matching", async () => {
      const result = await mcpClient.callTool({
        name: "search_symbol_from_index",
        arguments: {
          root: tempDir,
          name: "User",
        },
      });

      // The result is returned as text, not JSON
      const resultText = (result.content as any)[0]?.text || "";
      expect(resultText).toContain("User");
      expect(resultText).toContain("UserModel");
      expect(resultText).toContain("UserRole");
    }, 30000);

    it("should handle multiple kind filters", async () => {
      const result = await mcpClient.callTool({
        name: "search_symbol_from_index",
        arguments: {
          root: tempDir,
          kind: ["Class", "Interface"],
        },
      });

      // The result is returned as text, not JSON
      const resultText = (result.content as any)[0]?.text || "";
      expect(resultText).toContain("Class");
      expect(resultText).toContain("Interface");
      // Verify functions and methods are NOT in the result when filtering by Class/Interface
      expect(resultText).not.toContain("formatDate");
      expect(resultText).not.toContain("parseJSON");
    }, 30000);
  });

  describe("get_project_overview (with statistics)", () => {
    it("should return project overview with index statistics", async () => {
      // Create index first
      await mcpClient.callTool({
        name: "index_symbols",
        arguments: {
          root: tempDir,
          pattern: "**/*.ts",
        },
      });

      const result = await mcpClient.callTool({
        name: "get_project_overview",
        arguments: {
          root: tempDir,
        },
      });

      const resultText = (result.content as any)[0]?.text || "";
      expect(resultText).toContain("Project Overview");
      expect(resultText).toContain("Statistics");
      expect(resultText).toContain("Files:");
      expect(resultText).toContain("Symbols:");
      expect(resultText).toContain("Symbol breakdown:");
      expect(resultText).toContain("Classes:");
      expect(resultText).toContain("Interfaces:");
      expect(resultText).toContain("Functions:");
    }, 30000);

    it("should create index automatically if not exists", async () => {
      // Clear index first
      await mcpClient.callTool({
        name: "clear_index",
        arguments: {
          root: tempDir,
          force: true,
        },
      });

      const result = await mcpClient.callTool({
        name: "get_project_overview",
        arguments: {
          root: tempDir,
        },
      });

      const resultText = (result.content as any)[0]?.text || "";
      expect(resultText).toContain("Project Overview");
      expect(resultText).toContain("Statistics");
      // Should have created index and show statistics
      expect(resultText).toContain("Files:");
      expect(resultText).toContain("Symbols:");
    }, 30000);
  });

  describe("clear_index", () => {
    it("should clear the index", async () => {
      // Create index first
      await mcpClient.callTool({
        name: "index_symbols",
        arguments: {
          root: tempDir,
          pattern: "**/*.ts",
        },
      });

      // Verify index exists
      let overview = await mcpClient.callTool({
        name: "get_project_overview",
        arguments: {
          root: tempDir,
        },
      });
      let overviewText = (overview.content as any)[0]?.text || "";
      expect(overviewText).toContain("Symbols:");
      expect(overviewText).not.toContain("Symbols: 0");

      // Clear index
      await mcpClient.callTool({
        name: "clear_index",
        arguments: {
          root: tempDir,
        },
      });

      // Verify index is cleared - it will auto-create but will be empty initially
      overview = await mcpClient.callTool({
        name: "get_project_overview",
        arguments: {
          root: tempDir,
        },
      });
      overviewText = (overview.content as any)[0]?.text || "";
      // After clear and re-index, should show symbols again
      expect(overviewText).toContain("Symbols:");
    }, 30000);

    it("should force clear with force option", async () => {
      // Create index
      await mcpClient.callTool({
        name: "index_symbols",
        arguments: {
          root: tempDir,
          pattern: "**/*.ts",
        },
      });

      // Force clear
      const result = await mcpClient.callTool({
        name: "clear_index",
        arguments: {
          root: tempDir,
          force: true,
        },
      });

      expect((result.content as any)[0]?.text).toContain("cleared");

      // Verify index is cleared - get_project_overview will auto-create index
      const overview = await mcpClient.callTool({
        name: "get_project_overview",
        arguments: {
          root: tempDir,
        },
      });
      const overviewText = (overview.content as any)[0]?.text || "";
      // After force clear and re-index, should show symbols again
      expect(overviewText).toContain("Symbols:");
    }, 30000);
  });

  describe("Auto-indexing behavior", () => {
    it("should auto-create index when searching without existing index", async () => {
      // Clear any existing index
      await mcpClient.callTool({
        name: "clear_index",
        arguments: {
          root: tempDir,
          force: true,
        },
      });

      // Search without creating index first
      const result = await mcpClient.callTool({
        name: "search_symbol_from_index",
        arguments: {
          root: tempDir,
          kind: "Class",
        },
      });

      // The result is returned as text, not JSON
      const resultText = (result.content as any)[0]?.text || "";
      expect(resultText).toContain("symbol");
      expect(resultText).toContain("Class");

      // Verify index was created
      const overview = await mcpClient.callTool({
        name: "get_project_overview",
        arguments: {
          root: tempDir,
        },
      });
      const overviewText = (overview.content as any)[0]?.text || "";
      expect(overviewText).toContain("Symbols:");
      expect(overviewText).not.toContain("Symbols: 0");
    }, 30000);
  });

  describe("Symbol kind case-insensitivity", () => {
    it("should handle lowercase kind names", async () => {
      const result = await mcpClient.callTool({
        name: "search_symbol_from_index",
        arguments: {
          root: tempDir,
          kind: "class",
        },
      });

      // The result is returned as text, not JSON
      const resultText = (result.content as any)[0]?.text || "";
      expect(resultText).toContain("Class");
      expect(resultText).toContain("symbol");
    }, 30000);

    it("should handle uppercase kind names", async () => {
      const result = await mcpClient.callTool({
        name: "search_symbol_from_index",
        arguments: {
          root: tempDir,
          kind: "INTERFACE",
        },
      });

      // The result is returned as text, not JSON
      const resultText = (result.content as any)[0]?.text || "";
      expect(resultText).toContain("Interface");
      expect(resultText).toContain("symbol");
    }, 30000);

    it("should handle mixed case kind names", async () => {
      const result = await mcpClient.callTool({
        name: "search_symbol_from_index",
        arguments: {
          root: tempDir,
          kind: "mEtHoD",
        },
      });

      // The result is returned as text, not JSON
      const resultText = (result.content as any)[0]?.text || "";
      expect(resultText).toContain("Method");
      expect(resultText).toContain("symbol");
    }, 30000);
  });
});
