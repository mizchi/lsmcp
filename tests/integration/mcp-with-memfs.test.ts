import { describe, it, expect, beforeEach } from "vitest";
import { createFsFromVolume, Volume } from "memfs";
import { MemFileSystemApi } from "../../src/core/io/MemFileSystemApi.ts";
import type { FileSystemApi } from "../../src/core/io/FileSystemApi.ts";
import {
  createMcpServer,
  registerTool,
  McpServerState,
} from "../../src/mcp/utils/mcpServerHelpers.ts";
import {
  createListDirTool,
  createFindFileTool,
} from "../../src/mcp/tools/fileSystemToolsFactory.ts";
import type { ToolDef } from "../../src/mcp/utils/mcpHelpers.ts";
import { z } from "zod";

// Helper to create a proper .gitignore file content
function createGitignoreContent(): string {
  return "node_modules\ndist";
}

describe("MCP Server with memfs", () => {
  let fs: FileSystemApi;
  let serverState: McpServerState;
  let rootPath: string;

  beforeEach(async () => {
    // Create a new volume and filesystem
    const volume = new Volume();
    fs = new MemFileSystemApi(createFsFromVolume(volume));
    rootPath = "/mcp-test";

    // Create MCP server with filesystem
    serverState = createMcpServer({
      name: "test-mcp-server",
      version: "1.0.0",
      capabilities: {
        tools: true,
      },
      fileSystemApi: fs,
    });

    // Create test directory structure
    await fs.mkdir(rootPath, { recursive: true });
    await fs.mkdir(`${rootPath}/src`, { recursive: true });
    await fs.mkdir(`${rootPath}/tests`, { recursive: true });
    await fs.mkdir(`${rootPath}/docs`, { recursive: true });

    // Create test files
    await fs.writeFile(`${rootPath}/README.md`, "# Test Project", "utf-8");
    await fs.writeFile(`${rootPath}/package.json`, "{}", "utf-8");
    await fs.writeFile(
      `${rootPath}/.gitignore`,
      createGitignoreContent(),
      "utf-8",
    );
    await fs.writeFile(
      `${rootPath}/src/index.ts`,
      "console.log('hello');",
      "utf-8",
    );
    await fs.writeFile(`${rootPath}/src/utils.ts`, "export {};", "utf-8");
    await fs.writeFile(
      `${rootPath}/tests/test.spec.ts`,
      "describe('test', () => {});",
      "utf-8",
    );
    await fs.writeFile(
      `${rootPath}/docs/api.md`,
      "# API Documentation",
      "utf-8",
    );
  });

  it("should list directory contents with filesystem tools", async () => {
    // Create tool with our filesystem
    const listDirTool = createListDirTool(fs);

    // Mock process.cwd to return our test root
    const originalCwd = process.cwd;
    process.cwd = () => rootPath;

    try {
      const result = await listDirTool.execute({
        relativePath: ".",
        recursive: false,
        maxAnswerChars: 200000,
      });

      const parsed = JSON.parse(result);
      expect(parsed.directories).toContain("src");
      expect(parsed.directories).toContain("tests");
      expect(parsed.directories).toContain("docs");
      expect(parsed.files).toContain("README.md");
      expect(parsed.files).toContain("package.json");
    } finally {
      process.cwd = originalCwd;
    }
  });

  it("should find files with patterns", async () => {
    // Create components directory first
    await fs.mkdir(`${rootPath}/src/components`, { recursive: true });
    // Then create TypeScript files
    await fs.writeFile(
      `${rootPath}/src/components/Button.tsx`,
      "export {};",
      "utf-8",
    );
    await fs.writeFile(
      `${rootPath}/src/components/Input.tsx`,
      "export {};",
      "utf-8",
    );

    const findFileTool = createFindFileTool(fs);

    const originalCwd = process.cwd;
    process.cwd = () => rootPath;

    try {
      // Find all TypeScript files
      const tsResult = await findFileTool.execute({
        fileMask: "*.ts",
        relativePath: "src",
      });

      const tsParsed = JSON.parse(tsResult);
      expect(tsParsed.files).toContain("index.ts");
      expect(tsParsed.files).toContain("utils.ts");

      // Find all TSX files
      const tsxResult = await findFileTool.execute({
        fileMask: "*.tsx",
        relativePath: "src",
      });

      const tsxParsed = JSON.parse(tsxResult);
      expect(tsxParsed.files).toContain("components/Button.tsx");
      expect(tsxParsed.files).toContain("components/Input.tsx");
    } finally {
      process.cwd = originalCwd;
    }
  });

  it("should handle recursive directory listing", async () => {
    const listDirTool = createListDirTool(fs);

    const originalCwd = process.cwd;
    process.cwd = () => rootPath;

    try {
      const result = await listDirTool.execute({
        relativePath: ".",
        recursive: true,
        maxAnswerChars: 200000,
      });

      const parsed = JSON.parse(result);

      // Check directories
      expect(parsed.directories).toContain("src");
      expect(parsed.directories).toContain("tests");
      expect(parsed.directories).toContain("docs");

      // Check files at different levels
      expect(parsed.files).toContain("README.md");
      expect(parsed.files).toContain("src/index.ts");
      expect(parsed.files).toContain("src/utils.ts");
      expect(parsed.files).toContain("tests/test.spec.ts");
      expect(parsed.files).toContain("docs/api.md");
    } finally {
      process.cwd = originalCwd;
    }
  });

  it("should register and execute custom tools with filesystem", async () => {
    // Create a custom tool that uses filesystem
    const customTool: ToolDef<z.ZodObject<{ path: z.ZodString }>> = {
      name: "count_files",
      description: "Count files in a directory",
      schema: z.object({
        path: z.string(),
      }),
      execute: async ({ path }) => {
        const files = await serverState.fileSystemApi!.readdir(path);
        const count = files.length;
        return `Found ${count} items in ${path}`;
      },
    };

    // Register the tool
    registerTool(serverState, customTool);

    // Execute the tool
    const result = await customTool.execute({ path: `${rootPath}/src` });
    expect(result).toBe("Found 2 items in /mcp-test/src");
  });

  it("should handle errors gracefully", async () => {
    const listDirTool = createListDirTool(fs);

    const originalCwd = process.cwd;
    process.cwd = () => rootPath;

    try {
      // Try to list non-existent directory
      const result = await listDirTool.execute({
        relativePath: "non-existent",
        recursive: false,
        maxAnswerChars: 200000,
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe("Directory not found: non-existent");
    } finally {
      process.cwd = originalCwd;
    }
  });
});
