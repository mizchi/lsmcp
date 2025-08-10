import { describe, it, expect, beforeAll } from "vitest";
import { parseImports, resolveModulePath } from "./symbolResolver.ts";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { existsSync } from "fs";

describe("Neverthrow Library Integration", () => {
  const projectRoot = resolve(process.cwd());
  const neverthrowPath = resolve(projectRoot, "node_modules/neverthrow/dist/index.d.ts");
  
  beforeAll(() => {
    // Check if neverthrow is installed
    if (!existsSync(neverthrowPath)) {
      console.warn("⚠️  Neverthrow not installed. Run: pnpm add neverthrow --save-dev");
    }
  });

  describe("Neverthrow Symbol Detection", () => {
    it("should find neverthrow type definitions", async () => {
      if (!existsSync(neverthrowPath)) {
        console.log("Skipping: neverthrow not installed");
        return;
      }

      const content = await readFile(neverthrowPath, "utf-8");
      expect(content.length).toBeGreaterThan(0);
      
      // Verify file contains TypeScript declarations
      expect(content).toContain("declare");
      expect(content).toContain("export");
    });

    it("should detect all key neverthrow symbols", async () => {
      if (!existsSync(neverthrowPath)) {
        console.log("Skipping: neverthrow not installed");
        return;
      }

      const content = await readFile(neverthrowPath, "utf-8");
      
      const symbolsToFind = [
        "fromThrowable",
        "fromAsyncThrowable", 
        "Result",
        "Ok",
        "Err",
        "ResultAsync",
        "ok",
        "err",
        "okAsync",
        "errAsync",
      ];
      
      const foundSymbols: Record<string, number> = {};
      
      for (const symbol of symbolsToFind) {
        const regex = new RegExp(`\\b${symbol}\\b`, "g");
        const matches = content.match(regex);
        foundSymbols[symbol] = matches ? matches.length : 0;
      }
      
      // Verify core symbols are present
      expect(foundSymbols.fromThrowable).toBeGreaterThan(0);
      expect(foundSymbols.fromAsyncThrowable).toBeGreaterThan(0);
      expect(foundSymbols.Result).toBeGreaterThan(0);
      expect(foundSymbols.Ok).toBeGreaterThan(0);
      expect(foundSymbols.Err).toBeGreaterThan(0);
      expect(foundSymbols.ResultAsync).toBeGreaterThan(0);
      expect(foundSymbols.ok).toBeGreaterThan(0);
      expect(foundSymbols.err).toBeGreaterThan(0);
    });

    it("should find fromThrowable function declarations", async () => {
      if (!existsSync(neverthrowPath)) {
        console.log("Skipping: neverthrow not installed");
        return;
      }

      const content = await readFile(neverthrowPath, "utf-8");
      
      // Find fromThrowable function signatures
      const fromThrowableRegex = /fromThrowable[^;]+;/g;
      const matches = content.match(fromThrowableRegex);
      
      expect(matches).toBeDefined();
      expect(matches!.length).toBeGreaterThanOrEqual(2); // At least static method and export
      
      // Check for specific signatures
      const signatures = matches!.join("\n");
      expect(signatures).toContain("fromThrowable");
      expect(signatures).toContain("(...args");
      expect(signatures).toContain("Result");
    });

    it("should parse neverthrow exports correctly", async () => {
      if (!existsSync(neverthrowPath)) {
        console.log("Skipping: neverthrow not installed");
        return;
      }

      const content = await readFile(neverthrowPath, "utf-8");
      
      // Find the main export statement
      const exportMatch = content.match(/export\s*{([^}]+)}/);
      expect(exportMatch).toBeDefined();
      
      const exports = exportMatch![1]
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      // Verify essential exports
      expect(exports).toContain("fromThrowable");
      expect(exports).toContain("fromAsyncThrowable");
      expect(exports).toContain("Result");
      expect(exports).toContain("ResultAsync");
      expect(exports).toContain("Ok");
      expect(exports).toContain("Err");
      expect(exports).toContain("ok");
      expect(exports).toContain("err");
      expect(exports).toContain("okAsync");
      expect(exports).toContain("errAsync");
      
      // Should have at least 10 exports
      expect(exports.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("Import Parsing for Neverthrow", () => {
    it("should parse neverthrow imports correctly", () => {
      const testCode = `
        import { ok, err, Result, fromThrowable } from 'neverthrow';
        import { ResultAsync, fromAsyncThrowable } from 'neverthrow';
        import type { Ok, Err } from 'neverthrow';
      `;
      
      const imports = parseImports(testCode);
      
      expect(imports).toHaveLength(3);
      
      // First import
      expect(imports[0].source).toBe("neverthrow");
      expect(imports[0].specifiers).toHaveLength(4);
      expect(imports[0].specifiers.map(s => s.local)).toContain("ok");
      expect(imports[0].specifiers.map(s => s.local)).toContain("err");
      expect(imports[0].specifiers.map(s => s.local)).toContain("Result");
      expect(imports[0].specifiers.map(s => s.local)).toContain("fromThrowable");
      
      // Second import
      expect(imports[1].source).toBe("neverthrow");
      expect(imports[1].specifiers).toHaveLength(2);
      expect(imports[1].specifiers.map(s => s.local)).toContain("ResultAsync");
      expect(imports[1].specifiers.map(s => s.local)).toContain("fromAsyncThrowable");
      
      // Type-only import
      expect(imports[2].source).toBe("neverthrow");
      expect(imports[2].isTypeOnly).toBe(true);
      expect(imports[2].specifiers).toHaveLength(2);
      expect(imports[2].specifiers.map(s => s.local)).toContain("Ok");
      expect(imports[2].specifiers.map(s => s.local)).toContain("Err");
    });

    it("should resolve neverthrow module path", () => {
      const testFile = resolve(projectRoot, "test.ts");
      const resolvedPath = resolveModulePath("neverthrow", testFile, projectRoot);
      
      if (existsSync(neverthrowPath)) {
        expect(resolvedPath).toBe(neverthrowPath);
      } else {
        expect(resolvedPath).toBeNull();
      }
    });
  });

  describe("Symbol Statistics", () => {
    it("should count symbol occurrences in neverthrow", async () => {
      if (!existsSync(neverthrowPath)) {
        console.log("Skipping: neverthrow not installed");
        return;
      }

      const content = await readFile(neverthrowPath, "utf-8");
      
      const stats = {
        fromThrowable: (content.match(/\bfromThrowable\b/g) || []).length,
        fromAsyncThrowable: (content.match(/\bfromAsyncThrowable\b/g) || []).length,
        Result: (content.match(/\bResult\b/g) || []).length,
        ResultAsync: (content.match(/\bResultAsync\b/g) || []).length,
        Ok: (content.match(/\bOk\b/g) || []).length,
        Err: (content.match(/\bErr\b/g) || []).length,
      };
      
      // Log statistics for debugging
      console.log("Neverthrow symbol statistics:", stats);
      
      // Verify reasonable counts
      expect(stats.fromThrowable).toBeGreaterThanOrEqual(4); // At least 4 occurrences
      expect(stats.fromAsyncThrowable).toBeGreaterThanOrEqual(2);
      expect(stats.Result).toBeGreaterThan(50); // Result is used extensively
      expect(stats.ResultAsync).toBeGreaterThan(30);
      expect(stats.Ok).toBeGreaterThan(10);
      expect(stats.Err).toBeGreaterThan(10);
    });
  });
});