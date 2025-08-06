import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initialize, shutdown } from "../../src/lsp/lspClient.ts";
import { spawn } from "child_process";
import { createFsFromVolume, Volume } from "memfs";
import { MemFileSystemApi } from "../../src/core/io/MemFileSystemApi.ts";
import type { FileSystemApi } from "../../src/core/io/FileSystemApi.ts";
import { findTypescriptLanguageServer } from "../../src/ts/utils/findTypescriptLanguageServer.ts";
import { pathToFileURL } from "url";

describe.skip("LSP Client with memfs", () => {
  let fs: FileSystemApi;
  let volume: Volume;
  let rootPath: string;

  beforeEach(async () => {
    // Create a new volume and filesystem for each test
    volume = new Volume();
    fs = new MemFileSystemApi(createFsFromVolume(volume));
    rootPath = "/test-project";

    // Create project structure
    await fs.mkdir(rootPath, { recursive: true });
    await fs.mkdir(`${rootPath}/src`, { recursive: true });

    // Create a simple TypeScript project
    await fs.writeFile(
      `${rootPath}/package.json`,
      JSON.stringify({
        name: "test-project",
        version: "1.0.0",
        devDependencies: {
          typescript: "*",
        },
      }),
      "utf-8",
    );

    await fs.writeFile(
      `${rootPath}/tsconfig.json`,
      JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          module: "commonjs",
          strict: true,
        },
      }),
      "utf-8",
    );
  });

  afterEach(async () => {
    await shutdown();
  });

  it("should handle file operations with memfs", async () => {
    // Create a TypeScript file in memfs
    const filePath = `${rootPath}/src/test.ts`;
    const fileContent = `
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export interface User {
  id: number;
  name: string;
}
`;
    await fs.writeFile(filePath, fileContent, "utf-8");

    // Find TypeScript language server
    const tsServerPath = await findTypescriptLanguageServer();
    if (!tsServerPath) {
      throw new Error("TypeScript language server not found");
    }

    // Start TypeScript language server process
    const serverProcess = spawn("node", [tsServerPath, "--stdio"], {
      cwd: rootPath,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Initialize LSP client with memfs
    const client = await initialize(
      rootPath,
      serverProcess,
      "typescript",
      undefined,
      undefined,
      fs, // Pass our memfs instance
    );

    // Test file operations
    const fileUri = pathToFileURL(filePath).toString();

    // Open document with content from memfs
    const content = await fs.readFile(filePath, "utf-8");
    client.openDocument(fileUri, content);

    // Get hover information
    const hoverResult = await client.getHover(fileUri, {
      line: 1, // "greet" function
      character: 17,
    });

    expect(hoverResult).toBeTruthy();
    expect(hoverResult?.contents).toBeTruthy();

    // Get document symbols
    const symbols = await client.getDocumentSymbols(fileUri);
    expect(symbols).toHaveLength(2); // greet function and User interface
    expect(symbols.some((s) => s.name === "greet")).toBe(true);
    expect(symbols.some((s) => s.name === "User")).toBe(true);

    // Test file update
    const updatedContent = fileContent + "\nexport const VERSION = '1.0.0';";
    await fs.writeFile(filePath, updatedContent, "utf-8");
    client.updateDocument(fileUri, updatedContent, 2);

    // Get updated symbols
    const updatedSymbols = await client.getDocumentSymbols(fileUri);
    expect(updatedSymbols).toHaveLength(3);
    expect(updatedSymbols.some((s) => s.name === "VERSION")).toBe(true);

    // Cleanup
    client.closeDocument(fileUri);
  });

  it("should handle multiple files with references", async () => {
    // Create multiple files
    const userFile = `${rootPath}/src/user.ts`;
    await fs.writeFile(
      userFile,
      `export interface User {
  id: number;
  name: string;
}`,
      "utf-8",
    );

    const serviceFile = `${rootPath}/src/service.ts`;
    await fs.writeFile(
      serviceFile,
      `import { User } from './user';

export class UserService {
  getUser(id: number): User {
    return { id, name: 'Test User' };
  }
}`,
      "utf-8",
    );

    // Start TypeScript language server
    const tsServerPath = await findTypescriptLanguageServer();
    if (!tsServerPath) {
      throw new Error("TypeScript language server not found");
    }

    const serverProcess = spawn("node", [tsServerPath, "--stdio"], {
      cwd: rootPath,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Initialize LSP client
    const client = await initialize(
      rootPath,
      serverProcess,
      "typescript",
      undefined,
      undefined,
      fs,
    );

    // Open both files
    const userUri = pathToFileURL(userFile).toString();
    const serviceUri = pathToFileURL(serviceFile).toString();

    const userContent = await fs.readFile(userFile, "utf-8");
    const serviceContent = await fs.readFile(serviceFile, "utf-8");

    client.openDocument(userUri, userContent);
    client.openDocument(serviceUri, serviceContent);

    // Find references to User interface
    const references = await client.findReferences(userUri, {
      line: 0, // User interface declaration
      character: 17,
    });

    expect(references).toHaveLength(2); // Declaration and usage
    expect(references.some((r) => r.uri === userUri)).toBe(true);
    expect(references.some((r) => r.uri === serviceUri)).toBe(true);

    // Get definition from service file
    const definition = await client.getDefinition(serviceUri, {
      line: 0, // import statement
      character: 9, // "User" in import
    });

    expect(definition).toBeTruthy();
    const defLocation = Array.isArray(definition) ? definition[0] : definition;
    expect(defLocation?.uri).toBe(userUri);

    // Cleanup
    client.closeDocument(userUri);
    client.closeDocument(serviceUri);
  });

  it("should handle diagnostics with memfs", async () => {
    // Create a file with errors
    const errorFile = `${rootPath}/src/errors.ts`;
    await fs.writeFile(
      errorFile,
      `function add(a: number, b: number): string {
  return a + b; // Type error: number is not assignable to string
}

const result = add("not", "numbers"); // Type error: string is not assignable to number
`,
      "utf-8",
    );

    // Start TypeScript language server
    const tsServerPath = await findTypescriptLanguageServer();
    if (!tsServerPath) {
      throw new Error("TypeScript language server not found");
    }

    const serverProcess = spawn("node", [tsServerPath, "--stdio"], {
      cwd: rootPath,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Initialize LSP client
    const client = await initialize(
      rootPath,
      serverProcess,
      "typescript",
      undefined,
      undefined,
      fs,
    );

    const fileUri = pathToFileURL(errorFile).toString();
    const content = await fs.readFile(errorFile, "utf-8");

    // Open document
    client.openDocument(fileUri, content);

    // Wait for diagnostics
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get diagnostics
    const diagnostics = client.getDiagnostics(fileUri);

    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.some((d) => d.severity === 1)).toBe(true); // Error severity

    // Cleanup
    client.closeDocument(fileUri);
  });
});
