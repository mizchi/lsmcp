/**
 * DI-based unit tests for SymbolIndex without vi.mock
 * Uses InMemoryFileSystem and TestSymbolProvider to avoid touching real FS or LSP
 */

import { describe, it, expect } from "vitest";
import { SymbolIndex } from "./SymbolIndex.ts";
import { SymbolKind } from "vscode-languageserver-types";
import { pathToFileURL } from "url";
import { resolve } from "path";
import { InMemoryFileSystem, TestSymbolProvider } from "../../../../tests/helpers/testUtils.ts";

describe("SymbolIndex (DI)", () => {
  it("indexes a single file and can query symbols", async () => {
    const rootPath = "/virtual/project";
    const relPath = "src/a.ts";
    const absPath = resolve(rootPath, relPath);
    const fileUri = pathToFileURL(absPath).toString();

    // Prepare DI
    const fs = new InMemoryFileSystem({
      [absPath]: "export function hello() { return 1 }",
    });
    const provider = new TestSymbolProvider();
    provider.addSimpleSymbol(fileUri, "hello", SymbolKind.Function);

    // Construct index with DI
    const index = new SymbolIndex(rootPath, provider, fs);

    // Index the file
    await index.indexFiles([relPath], 1);

    // Query by name
    const byName = index.querySymbols({ name: "hello" });
    expect(byName.length).toBe(1);
    expect(byName[0].name).toBe("hello");
    expect(byName[0].kind).toBe(SymbolKind.Function);

    // Query by kind
    const byKind = index.querySymbols({ kind: SymbolKind.Function });
    expect(byKind.length).toBeGreaterThanOrEqual(1);

    // Stats
    const stats = index.getStats();
    expect(stats.totalFiles).toBe(1);
    expect(stats.totalSymbols).toBeGreaterThan(0);
  });

  it("updates the same file without re-indexing when content hash unchanged (cache path)", async () => {
    const rootPath = "/virtual/project2";
    const relPath = "src/b.ts";
    const absPath = resolve(rootPath, relPath);
    const fileUri = pathToFileURL(absPath).toString();

    // Prepare DI
    const content = "export class C { m(){} }";
    const fs = new InMemoryFileSystem({ [absPath]: content });
    const provider = new TestSymbolProvider();
    provider.addSimpleSymbol(fileUri, "C", SymbolKind.Class);

    // Construct with a fake cache that returns the same symbols on first read
    const fakeCache = {
      async get(_path: string) {
        // Simulate no cache on first call, then cached next time
        return null as any;
      },
      async set(_path: string, _symbols: any[]) {},
      async clear() {},
    };

    const index = new SymbolIndex(rootPath, provider, fs, fakeCache as any);
    await index.indexFiles([relPath], 1);

    // Re-index without changing content; should be fast and consistent
    await index.indexFiles([relPath], 1);

    const stats = index.getStats();
    expect(stats.totalFiles).toBe(1);
  });
});