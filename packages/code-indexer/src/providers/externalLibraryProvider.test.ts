import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  getNodeModulesDeclarations,
  groupFilesByLibrary,
  getAvailableTypescriptDependencies,
  indexDeclarationFile,
  indexExternalLibraries,
} from "./externalLibraryProvider.ts";
import { createLSPClient } from "@internal/lsp-client";
import { spawn } from "child_process";

// Mock adapter for testing
const typescriptAdapter = {
  id: "typescript",
  name: "TypeScript Language Server",
  bin: "typescript-language-server",
  args: ["--stdio"],
  initializationOptions: {},
  serverCharacteristics: {
    documentOpenDelay: 100,
    operationTimeout: 5000,
  },
};

function resolveAdapterCommand(adapter: any, _projectRoot?: string) {
  return {
    command: adapter.bin,
    args: adapter.args || [],
  };
}

describe("ExternalLibraryProvider", () => {
  let tempDir: string;
  let client: any;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "lsmcp-test-"));

    // Create a mock node_modules structure
    const nodeModulesDir = join(tempDir, "node_modules");
    await mkdir(nodeModulesDir, { recursive: true });

    // Create mock @types/node
    const typesNodeDir = join(nodeModulesDir, "@types", "node");
    await mkdir(typesNodeDir, { recursive: true });
    await writeFile(
      join(typesNodeDir, "package.json"),
      JSON.stringify({
        name: "@types/node",
        version: "20.0.0",
        types: "index.d.ts",
      }),
    );
    await writeFile(
      join(typesNodeDir, "index.d.ts"),
      `declare module 'fs' {
        export function readFile(path: string): Promise<string>;
        export function writeFile(path: string, data: string): Promise<void>;
      }
      declare module 'path' {
        export function join(...paths: string[]): string;
      }`,
    );

    // Create mock library with .d.ts files
    const mockLibDir = join(nodeModulesDir, "mock-lib");
    await mkdir(mockLibDir, { recursive: true });
    await writeFile(
      join(mockLibDir, "package.json"),
      JSON.stringify({
        name: "mock-lib",
        version: "1.0.0",
        types: "index.d.ts",
      }),
    );
    await writeFile(
      join(mockLibDir, "index.d.ts"),
      `export interface MockInterface {
        foo: string;
        bar: number;
      }
      export function mockFunction(input: string): MockInterface;
      export class MockClass {
        constructor(value: string);
        getValue(): string;
      }`,
    );

    // Create a package.json in the temp directory
    await writeFile(
      join(tempDir, "package.json"),
      JSON.stringify({
        name: "test-project",
        dependencies: {
          "mock-lib": "1.0.0",
        },
        devDependencies: {
          "@types/node": "20.0.0",
        },
      }),
    );
  });

  afterEach(async () => {
    if (client) {
      await client.stop();
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("getNodeModulesDeclarations", () => {
    it("should find .d.ts files in node_modules", async () => {
      const files = await getNodeModulesDeclarations(tempDir);

      expect(files.length).toBeGreaterThan(0);
      // Normalize paths for cross-platform compatibility
      expect(files.some((f) => f.replace(/\\/g, '/').includes("@types/node"))).toBe(true);
      expect(files.some((f) => f.replace(/\\/g, '/').includes("mock-lib"))).toBe(true);
      expect(files.every((f) => f.endsWith(".d.ts"))).toBe(true);
    });

    it("should respect maxFiles limit", async () => {
      const files = await getNodeModulesDeclarations(tempDir, { maxFiles: 1 });
      expect(files.length).toBeLessThanOrEqual(1);
    });

    it("should handle missing node_modules gracefully", async () => {
      const emptyDir = await mkdtemp(join(tmpdir(), "empty-"));
      const files = await getNodeModulesDeclarations(emptyDir);
      expect(files).toEqual([]);
      await rm(emptyDir, { recursive: true });
    });
  });

  describe("groupFilesByLibrary", () => {
    it("should group files by their library", async () => {
      const files = await getNodeModulesDeclarations(tempDir);
      const libraries = await groupFilesByLibrary(files, tempDir);

      expect(libraries.size).toBeGreaterThan(0);
      // On Windows, the keys might use backslashes
      const hasTypesNode = libraries.has("@types/node") || libraries.has("@types\\node");
      const hasMockLib = libraries.has("mock-lib");
      expect(hasTypesNode).toBe(true);
      expect(hasMockLib).toBe(true);

      const typesNode = libraries.get("@types/node") || libraries.get("@types\\node");
      expect(typesNode).toBeDefined();
      expect(typesNode?.name).toBe("@types/node");
      expect(typesNode?.version).toBe("20.0.0");
      expect(typesNode?.typingsFiles.length).toBeGreaterThan(0);
    });
  });

  describe("getAvailableTypescriptDependencies", () => {
    it("should list TypeScript dependencies from package.json", async () => {
      const deps = await getAvailableTypescriptDependencies(tempDir);

      expect(deps).toContain("mock-lib");
      expect(deps).toContain("@types/node");
    });

    it("should handle missing package.json", async () => {
      const emptyDir = await mkdtemp(join(tmpdir(), "empty-"));
      const deps = await getAvailableTypescriptDependencies(emptyDir);
      expect(deps).toEqual([]);
      await rm(emptyDir, { recursive: true });
    });
  });

  describe.skip("indexDeclarationFile", () => {
    it("should index symbols from a declaration file", async () => {
      // Initialize TypeScript LSP client
      const resolved = resolveAdapterCommand(typescriptAdapter, tempDir);
      const lspProcess = spawn(resolved.command, resolved.args, {
        cwd: tempDir,
        env: process.env,
      });

      const lspClient = createLSPClient({
        rootPath: tempDir,
        process: lspProcess,
        languageId: typescriptAdapter.id,
        initializationOptions: typescriptAdapter.initializationOptions,
        serverCharacteristics: typescriptAdapter.serverCharacteristics,
      });

      await lspClient.start();
      client = lspClient;

      const mockLibFile = join(
        tempDir,
        "node_modules",
        "mock-lib",
        "index.d.ts",
      );
      const result = await indexDeclarationFile(mockLibFile, client);

      expect(result).toBeDefined();
      expect(result?.symbols.length).toBeGreaterThan(0);

      const symbolNames = result?.symbols.map((s) => s.name);
      expect(symbolNames).toContain("MockInterface");
      expect(symbolNames).toContain("mockFunction");
      expect(symbolNames).toContain("MockClass");
    });
  });

  describe.skip("indexExternalLibraries", () => {
    it("should index all external libraries", async () => {
      // Initialize TypeScript LSP client
      const resolved = resolveAdapterCommand(typescriptAdapter, tempDir);
      const lspProcess = spawn(resolved.command, resolved.args, {
        cwd: tempDir,
        env: process.env,
      });

      const lspClient = createLSPClient({
        rootPath: tempDir,
        process: lspProcess,
        languageId: typescriptAdapter.id,
        initializationOptions: typescriptAdapter.initializationOptions,
        serverCharacteristics: typescriptAdapter.serverCharacteristics,
      });

      await lspClient.start();
      client = lspClient;

      const result = await indexExternalLibraries(tempDir, client, {
        maxFiles: 10,
      });

      expect(result.libraries.size).toBeGreaterThan(0);
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.totalSymbols).toBeGreaterThan(0);
      expect(result.indexingTime).toBeGreaterThan(0);

      // Check that we indexed the expected libraries
      expect(result.libraries.has("@types/node")).toBe(true);
      expect(result.libraries.has("mock-lib")).toBe(true);
    });
  });
});
