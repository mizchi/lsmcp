import { describe, it, expect, beforeEach } from "vitest";
import {
  ContentHashDiffChecker,
  OptimizedDiffChecker,
  type FileDiffChecker,
} from "./fileDiffDetector.ts";
import { createTestFileSymbols } from "./testHelpers.ts";

describe("ContentHashDiffChecker", () => {
  let checker: ContentHashDiffChecker;

  beforeEach(() => {
    checker = new ContentHashDiffChecker();
  });

  describe("checkFile", () => {
    it("should detect new file", () => {
      const content = "const x = 1;";
      const result = checker.checkFile(content, undefined);

      expect(result.hasChanged).toBe(true);
      expect(result.reason).toBe("new");
      expect(result.contentHash).toBeDefined();
      expect(result.contentHash.length).toBeGreaterThan(0);
    });

    it("should detect unchanged file with same content", () => {
      const content = "const x = 1;";
      const existingFile = createTestFileSymbols({
        contentHash: "749b17640bf18d96c509f518d6f1a4b41d8cdc60", // SHA1 hash of "const x = 1;"
      });

      const result = checker.checkFile(content, existingFile);

      expect(result.hasChanged).toBe(false);
      expect(result.reason).toBe("unchanged");
      expect(result.contentHash).toBe(existingFile.contentHash);
    });

    it("should detect changed file with different content", () => {
      const content = "const x = 2;"; // Different content
      const existingFile = createTestFileSymbols({
        contentHash: "749b17640bf18d96c509f518d6f1a4b41d8cdc60", // SHA1 hash of "const x = 1;"
      });

      const result = checker.checkFile(content, existingFile);

      expect(result.hasChanged).toBe(true);
      expect(result.reason).toBe("content-changed");
      expect(result.contentHash).not.toBe(existingFile.contentHash);
    });

    it("should handle empty content", () => {
      const content = "";
      const result = checker.checkFile(content, undefined);

      expect(result.hasChanged).toBe(true);
      expect(result.reason).toBe("new");
      expect(result.contentHash).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709"); // SHA1 hash of empty string
    });

    it("should handle large content", () => {
      const content = "x".repeat(100000); // 100KB of 'x'
      const result = checker.checkFile(content, undefined);

      expect(result.hasChanged).toBe(true);
      expect(result.reason).toBe("new");
      expect(result.contentHash).toBeDefined();
      expect(result.contentHash.length).toBeGreaterThan(0);
    });

    it("should handle unicode content", () => {
      const content = "const 変数 = '🎉 Unicode テスト';";
      const result = checker.checkFile(content, undefined);

      expect(result.hasChanged).toBe(true);
      expect(result.reason).toBe("new");
      expect(result.contentHash).toBeDefined();
      expect(result.contentHash.length).toBeGreaterThan(0);
    });

    it("should produce consistent hashes for same content", () => {
      const content = "function test() { return 42; }";
      
      const result1 = checker.checkFile(content, undefined);
      const result2 = checker.checkFile(content, undefined);

      expect(result1.contentHash).toBe(result2.contentHash);
    });

    it("should produce different hashes for different content", () => {
      const content1 = "function test() { return 42; }";
      const content2 = "function test() { return 43; }"; // One character different
      
      const result1 = checker.checkFile(content1, undefined);
      const result2 = checker.checkFile(content2, undefined);

      expect(result1.contentHash).not.toBe(result2.contentHash);
    });
  });
});

describe("OptimizedDiffChecker", () => {
  let checker: ContentHashDiffChecker; // OptimizedDiffChecker is now an alias

  beforeEach(() => {
    checker = new OptimizedDiffChecker();
  });

  describe("checkFile", () => {
    it("should currently delegate to ContentHashDiffChecker", () => {
      const content = "const x = 1;";
      const result = checker.checkFile(content, undefined);

      expect(result.hasChanged).toBe(true);
      expect(result.reason).toBe("new");
      expect(result.contentHash).toBeDefined();
    });

    it("should handle unchanged files", () => {
      const content = "const x = 1;";
      const existingFile = createTestFileSymbols({
        contentHash: "749b17640bf18d96c509f518d6f1a4b41d8cdc60", // SHA1 hash
      });

      const result = checker.checkFile(content, existingFile);

      expect(result.hasChanged).toBe(false);
      expect(result.reason).toBe("unchanged");
    });
  });
});

describe("FileDiffChecker Performance", () => {
  it("should handle many small files efficiently", () => {
    const checker = new ContentHashDiffChecker();
    const files = Array.from({ length: 1000 }, (_, i) => `const x = ${i};`);
    
    const startTime = Date.now();
    for (const content of files) {
      checker.checkFile(content, undefined);
    }
    const duration = Date.now() - startTime;

    // Should process 1000 small files in under 100ms
    expect(duration).toBeLessThan(100);
  });

  it("should handle large files efficiently", () => {
    const checker = new ContentHashDiffChecker();
    const largeContent = "x".repeat(1000000); // 1MB of content
    
    const startTime = Date.now();
    checker.checkFile(largeContent, undefined);
    const duration = Date.now() - startTime;

    // Should hash 1MB in under 50ms
    expect(duration).toBeLessThan(50);
  });
});

// Test helper for verifying implementation contracts
describe("FileDiffChecker Contract", () => {
  const testImplementations: Array<[string, () => FileDiffChecker]> = [
    ["ContentHashDiffChecker", () => new ContentHashDiffChecker()],
    ["OptimizedDiffChecker", () => new ContentHashDiffChecker()], // Alias
  ];

  testImplementations.forEach(([name, createChecker]) => {
    describe(name, () => {
      let checker: FileDiffChecker;

      beforeEach(() => {
        checker = createChecker();
      });

      it("should always return hasChanged=true for new files", () => {
        const result = checker.checkFile("content", undefined);
        expect(result.hasChanged).toBe(true);
        expect(result.reason).toBe("new");
      });

      it("should always include contentHash in result", () => {
        const result = checker.checkFile("content", undefined);
        expect(result.contentHash).toBeDefined();
        expect(typeof result.contentHash).toBe("string");
        expect(result.contentHash.length).toBeGreaterThan(0);
      });

      it("should always include reason in result", () => {
        const result = checker.checkFile("content", undefined);
        expect(["new", "content-changed", "unchanged"]).toContain(result.reason);
      });
    });
  });
});