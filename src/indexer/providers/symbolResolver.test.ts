import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  parseImports,
  resolveModulePath,
  getAvailableExternalSymbols,
} from "./symbolResolver.ts";

describe("Symbol Resolver", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "lsmcp-resolver-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("parseImports", () => {
    it("should parse named imports", () => {
      const code = `
        import { ok, Ok, Err } from 'neverthrow';
        import { Result } from 'neverthrow';
      `;
      
      const imports = parseImports(code);
      
      expect(imports).toHaveLength(2);
      expect(imports[0].source).toBe("neverthrow");
      expect(imports[0].specifiers).toHaveLength(3);
      expect(imports[0].specifiers[0]).toEqual({
        imported: "ok",
        local: "ok",
      });
      expect(imports[0].specifiers[1]).toEqual({
        imported: "Ok",
        local: "Ok",
      });
      expect(imports[0].specifiers[2]).toEqual({
        imported: "Err",
        local: "Err",
      });
    });

    it("should parse imports with aliases", () => {
      const code = `
        import { Ok as OkType, Err as ErrType } from 'neverthrow';
      `;
      
      const imports = parseImports(code);
      
      expect(imports).toHaveLength(1);
      expect(imports[0].specifiers).toHaveLength(2);
      expect(imports[0].specifiers[0]).toEqual({
        imported: "Ok",
        local: "OkType",
      });
      expect(imports[0].specifiers[1]).toEqual({
        imported: "Err",
        local: "ErrType",
      });
    });

    it("should parse namespace imports", () => {
      const code = `
        import * as Result from 'neverthrow';
      `;
      
      const imports = parseImports(code);
      
      expect(imports).toHaveLength(1);
      expect(imports[0].source).toBe("neverthrow");
      expect(imports[0].specifiers).toHaveLength(1);
      expect(imports[0].specifiers[0]).toEqual({
        imported: "*",
        local: "Result",
        isNamespace: true,
      });
    });

    it("should parse default imports", () => {
      const code = `
        import neverthrow from 'neverthrow';
      `;
      
      const imports = parseImports(code);
      
      expect(imports).toHaveLength(1);
      expect(imports[0].specifiers).toHaveLength(1);
      expect(imports[0].specifiers[0]).toEqual({
        imported: "default",
        local: "neverthrow",
        isDefault: true,
      });
    });

    it("should parse combined default and named imports", () => {
      const code = `
        import neverthrow, { ok, Ok, Err } from 'neverthrow';
      `;
      
      const imports = parseImports(code);
      
      expect(imports).toHaveLength(1);
      expect(imports[0].specifiers).toHaveLength(4);
      expect(imports[0].specifiers[0]).toEqual({
        imported: "default",
        local: "neverthrow",
        isDefault: true,
      });
      expect(imports[0].specifiers[1]).toEqual({
        imported: "ok",
        local: "ok",
      });
    });

    it("should parse type-only imports", () => {
      const code = `
        import type { Result } from 'neverthrow';
        import type { Ok, Err } from 'neverthrow';
      `;
      
      const imports = parseImports(code);
      
      expect(imports).toHaveLength(2);
      expect(imports[0].isTypeOnly).toBe(true);
      expect(imports[1].isTypeOnly).toBe(true);
    });
  });

  describe("resolveModulePath", () => {
    it("should resolve relative imports", async () => {
      // Create test files
      const srcDir = join(tempDir, "src");
      await mkdir(srcDir, { recursive: true });
      
      const utilsPath = join(srcDir, "utils.ts");
      await writeFile(utilsPath, "export const util = () => {};");
      
      const mainPath = join(srcDir, "main.ts");
      await writeFile(mainPath, "import { util } from './utils';");
      
      const resolved = resolveModulePath("./utils", mainPath, tempDir);
      expect(resolved).toBe(utilsPath);
    });

    it("should resolve node_modules imports with package.json types", async () => {
      // Create mock node_modules structure
      const nodeModulesDir = join(tempDir, "node_modules", "neverthrow");
      await mkdir(nodeModulesDir, { recursive: true });
      
      await writeFile(
        join(nodeModulesDir, "package.json"),
        JSON.stringify({
          name: "neverthrow",
          version: "6.0.0",
          types: "dist/index.d.ts",
        })
      );
      
      const typesPath = join(nodeModulesDir, "dist", "index.d.ts");
      await mkdir(join(nodeModulesDir, "dist"), { recursive: true });
      await writeFile(typesPath, "export const ok = () => {};");
      
      const testFile = join(tempDir, "test.ts");
      const resolved = resolveModulePath("neverthrow", testFile, tempDir);
      
      expect(resolved).toBe(typesPath);
    });

    it("should resolve @types packages", async () => {
      // Create @types structure
      const typesDir = join(tempDir, "node_modules", "@types", "node");
      await mkdir(typesDir, { recursive: true });
      
      const indexPath = join(typesDir, "index.d.ts");
      await writeFile(indexPath, "declare module 'fs' {}");
      
      const testFile = join(tempDir, "test.ts");
      const resolved = resolveModulePath("node", testFile, tempDir);
      
      expect(resolved).toBe(indexPath);
    });
  });

  describe("neverthrow library integration", () => {
    it("should create neverthrow-like test structure", async () => {
      // Create a mock neverthrow library structure
      const neverthrowDir = join(tempDir, "node_modules", "neverthrow");
      await mkdir(neverthrowDir, { recursive: true });
      
      // Create package.json
      await writeFile(
        join(neverthrowDir, "package.json"),
        JSON.stringify({
          name: "neverthrow",
          version: "6.0.0",
          types: "index.d.ts",
        })
      );
      
      // Create type definitions similar to neverthrow
      await writeFile(
        join(neverthrowDir, "index.d.ts"),
        `
export interface Ok<T, E> {
  readonly _tag: 'Ok';
  readonly value: T;
  isOk(): this is Ok<T, E>;
  isErr(): this is Err<T, E>;
}

export interface Err<T, E> {
  readonly _tag: 'Err';
  readonly error: E;
  isOk(): this is Ok<T, E>;
  isErr(): this is Err<T, E>;
}

export type Result<T, E> = Ok<T, E> | Err<T, E>;

export function ok<T = undefined, E = never>(value?: T): Ok<T, E>;
export function err<T = never, E = undefined>(error?: E): Err<T, E>;

export { Ok, Err };
        `
      );
      
      // Create a test file that uses neverthrow
      const testFile = join(tempDir, "test.ts");
      await writeFile(
        testFile,
        `
import { ok, Ok, Err, Result } from 'neverthrow';

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err('Division by zero');
  }
  return ok(a / b);
}

const result = divide(10, 2);
if (result.isOk()) {
  console.log('Result:', result.value);
} else {
  console.log('Error:', result.error);
}
        `
      );
      
      // Parse imports from the test file
      const sourceCode = await import("fs/promises").then(fs => fs.readFile(testFile, "utf-8"));
      const imports = parseImports(sourceCode);
      
      expect(imports).toHaveLength(1);
      expect(imports[0].source).toBe("neverthrow");
      expect(imports[0].specifiers).toHaveLength(4);
      
      // Verify module resolution
      const resolvedPath = resolveModulePath("neverthrow", testFile, tempDir);
      expect(resolvedPath).toBe(join(neverthrowDir, "index.d.ts"));
      
      // Get available external symbols
      const availableSymbols = await getAvailableExternalSymbols(testFile, tempDir);
      
      expect(availableSymbols.has("ok")).toBe(true);
      expect(availableSymbols.has("Ok")).toBe(true);
      expect(availableSymbols.has("Err")).toBe(true);
      expect(availableSymbols.has("Result")).toBe(true);
      
      const okResolution = availableSymbols.get("ok");
      expect(okResolution?.sourceModule).toBe("neverthrow");
      expect(okResolution?.resolvedPath).toBe(join(neverthrowDir, "index.d.ts"));
    });
  });

  describe("resolveSymbolFromImports with LSP", () => {
    it.skip("should resolve symbols from neverthrow with LSP", async () => {
      // This test requires actual LSP setup, so we skip it in unit tests
      // It would work in integration tests with a real TypeScript language server
      
      // Setup would involve:
      // 1. Creating actual neverthrow node_modules
      // 2. Starting TypeScript language server
      // 3. Resolving symbols through LSP
      
      expect(true).toBe(true);
    });
  });
});