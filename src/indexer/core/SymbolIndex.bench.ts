/**
 * Benchmark tests for SymbolIndex
 */

import { bench, describe } from "vitest";
import { SymbolIndex } from "./SymbolIndex.ts";
import { SymbolKind } from "vscode-languageserver-types";
import type {
  SymbolProvider,
  FileSystem,
  SymbolCache,
  IndexedSymbol,
} from "./types.ts";

// Mock implementations
const createMockProvider = (): SymbolProvider => ({
  getDocumentSymbols: async () => [
    {
      name: "TestClass",
      kind: SymbolKind.Class,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 10, character: 0 },
      },
      selectionRange: {
        start: { line: 0, character: 6 },
        end: { line: 0, character: 15 },
      },
      children: [
        {
          name: "constructor",
          kind: SymbolKind.Constructor,
          range: {
            start: { line: 2, character: 2 },
            end: { line: 4, character: 3 },
          },
          selectionRange: {
            start: { line: 2, character: 2 },
            end: { line: 2, character: 13 },
          },
        },
        {
          name: "method",
          kind: SymbolKind.Method,
          range: {
            start: { line: 6, character: 2 },
            end: { line: 8, character: 3 },
          },
          selectionRange: {
            start: { line: 6, character: 2 },
            end: { line: 6, character: 8 },
          },
        },
      ],
    },
  ],
  getDefinitions: async () => [],
  findReferences: async () => [],
  getHover: async () => null,
  getCompletion: async () => null,
  getDiagnostics: async () => [],
  getWorkspaceSymbols: async () => [],
});

const createMockFileSystem = (fileCount: number): FileSystem => ({
  readFile: async () => `export class Test${Math.random()} { }`,
  exists: async () => true,
  stat: async () => ({ mtime: new Date(), size: 1000 }),
  readdir: async () => [],
  glob: async () => Array.from({ length: fileCount }, (_, i) => `file${i}.ts`),
  watchFiles: () => ({ dispose: () => {} }),
  dispose: () => {},
});

const createMockCache = (): SymbolCache => ({
  get: async () => null,
  set: async () => {},
  has: async () => false,
  delete: async () => {},
  clear: async () => {},
  keys: async () => [],
});

describe("SymbolIndex Benchmarks", () => {
  bench("index 100 files", async () => {
    const symbolIndex = new SymbolIndex(
      "/test/root",
      createMockProvider(),
      createMockFileSystem(100),
      createMockCache(),
    );

    const files = Array.from({ length: 100 }, (_, i) => `file${i}.ts`);
    await symbolIndex.indexFiles(files);
  });

  bench("index 500 files", async () => {
    const symbolIndex = new SymbolIndex(
      "/test/root",
      createMockProvider(),
      createMockFileSystem(500),
      createMockCache(),
    );

    const files = Array.from({ length: 500 }, (_, i) => `file${i}.ts`);
    await symbolIndex.indexFiles(files);
  });

  bench("index 1000 files", async () => {
    const symbolIndex = new SymbolIndex(
      "/test/root",
      createMockProvider(),
      createMockFileSystem(1000),
      createMockCache(),
    );

    const files = Array.from({ length: 1000 }, (_, i) => `file${i}.ts`);
    await symbolIndex.indexFiles(files);
  });

  bench("incremental update with 100 modified files", async () => {
    const symbolIndex = new SymbolIndex(
      "/test/root",
      createMockProvider(),
      createMockFileSystem(100),
      createMockCache(),
    );

    // First, index some files
    await symbolIndex.indexFiles(["initial.ts"]);

    // Mock the incremental update by directly calling with mocked git functions
    const mockGitHash = () => "new-hash-" + Date.now();
    const mockModifiedFiles = () =>
      Array.from({ length: 100 }, (_, i) => `modified${i}.ts`);

    // Direct mock of the internal methods for benchmarking
    (symbolIndex as any).stats.lastGitHash = "old-hash";

    // Create test data for incremental update
    const testFiles = mockModifiedFiles();

    // Process files directly for benchmarking
    const results = await Promise.all(
      testFiles.map(async (file) => {
        await symbolIndex.indexFile(file);
        return file;
      }),
    );
  });

  bench("query symbols from 1000 indexed files", async () => {
    const symbolIndex = new SymbolIndex(
      "/test/root",
      createMockProvider(),
      createMockFileSystem(1000),
      createMockCache(),
    );

    // Index files first
    const files = Array.from({ length: 1000 }, (_, i) => `file${i}.ts`);
    await symbolIndex.indexFiles(files);

    // Benchmark query performance
    symbolIndex.querySymbols({ name: "Test" });
    symbolIndex.querySymbols({ kind: SymbolKind.Class });
    symbolIndex.querySymbols({ file: "file500.ts" });
  });

  bench("search symbols with partial match", async () => {
    const symbolIndex = new SymbolIndex(
      "/test/root",
      createMockProvider(),
      createMockFileSystem(500),
      createMockCache(),
    );

    // Index files first
    const files = Array.from({ length: 500 }, (_, i) => `file${i}.ts`);
    await symbolIndex.indexFiles(files);

    // Benchmark search performance
    symbolIndex.searchSymbols("Test");
    symbolIndex.searchSymbols("method");
    symbolIndex.searchSymbols("constructor");
  });

  bench("memory-efficient batch processing (5000 files)", async () => {
    const symbolIndex = new SymbolIndex(
      "/test/root",
      createMockProvider(),
      createMockFileSystem(5000),
      createMockCache(),
    );

    const files = Array.from({ length: 5000 }, (_, i) => `file${i}.ts`);

    // Process in batches of 100
    await symbolIndex.indexFiles(files, {
      batchSize: 100,
      onProgress: () => {}, // No-op for benchmarking
    });
  });

  bench("concurrent indexing with different batch sizes", async () => {
    const testBatchSizes = [10, 50, 100, 200];

    for (const batchSize of testBatchSizes) {
      const symbolIndex = new SymbolIndex(
        "/test/root",
        createMockProvider(),
        createMockFileSystem(1000),
        createMockCache(),
      );

      const files = Array.from({ length: 1000 }, (_, i) => `file${i}.ts`);
      await symbolIndex.indexFiles(files, { batchSize });
    }
  });

  bench("symbol retrieval from large index", async () => {
    const symbolIndex = new SymbolIndex(
      "/test/root",
      createMockProvider(),
      createMockFileSystem(2000),
      createMockCache(),
    );

    // Index a large number of files
    const files = Array.from({ length: 2000 }, (_, i) => `file${i}.ts`);
    await symbolIndex.indexFiles(files);

    // Benchmark symbol retrieval
    for (let i = 0; i < 100; i++) {
      const fileIndex = Math.floor(Math.random() * 2000);
      symbolIndex.getSymbols(`file${fileIndex}.ts`);
    }
  });
});
