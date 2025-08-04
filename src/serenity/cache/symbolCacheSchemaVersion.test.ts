import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SymbolCacheManager } from "./symbolCache.ts";
import { SQLiteCache } from "../../indexer/cache/SQLiteCache.ts";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { DatabaseSync } from "node:sqlite";
import { SymbolKind } from "vscode-languageserver-types";

describe("SymbolCacheManager Schema Versioning", () => {
  const testRoot = join(process.cwd(), "test-cache-versioning");
  let manager: SymbolCacheManager;

  beforeEach(() => {
    // Create test directory
    mkdirSync(join(testRoot, ".lsmcp", "cache"), { recursive: true });
  });

  afterEach(() => {
    // Clean up
    if (manager) {
      manager.close();
    }
    if (existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it("should create schema version table on first run", () => {
    manager = new SymbolCacheManager(testRoot);

    // Check that schema was not updated (first run)
    expect(manager.wasSchemaUpdated()).toBe(true); // First run is considered an update from 0
    expect(manager.getSchemaVersion()).toBe(2);
  });

  it("should detect schema update when version changes", () => {
    // First, create a manager with version 1
    manager = new SymbolCacheManager(testRoot);
    manager.close();

    // Simulate an older schema by manually updating the version
    const dbPath = join(testRoot, ".lsmcp", "cache", "symbols.db");
    const db = new DatabaseSync(dbPath);
    db.prepare("UPDATE schema_version SET version = 1").run();
    db.close();

    // Create a new manager - should detect schema update
    manager = new SymbolCacheManager(testRoot);
    expect(manager.wasSchemaUpdated()).toBe(true);
  });

  it("should not update schema when version is current", () => {
    // First run
    manager = new SymbolCacheManager(testRoot);
    manager.close();

    // Second run with same version
    manager = new SymbolCacheManager(testRoot);
    expect(manager.wasSchemaUpdated()).toBe(false);
  });

  it("should drop and recreate tables on schema update", async () => {
    // Create initial manager and add some data
    manager = new SymbolCacheManager(testRoot);

    // Add a test symbol
    const testSymbol = {
      name: "testFunction",
      kind: SymbolKind.Function,
      location: {
        uri: "file:///test.ts",
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 10 },
        },
      },
    };

    await manager.cacheSymbols("test.ts", [testSymbol], Date.now());

    // Verify symbol was cached
    const symbols = manager.getSymbolsByFile("test.ts");
    expect(symbols).toHaveLength(1);

    manager.close();

    // Simulate older schema
    const dbPath = join(testRoot, ".lsmcp", "cache", "symbols.db");
    const db = new DatabaseSync(dbPath);
    db.prepare("UPDATE schema_version SET version = 1").run();
    db.close();

    // Create new manager - should drop and recreate tables
    manager = new SymbolCacheManager(testRoot);

    // Verify old data was cleared
    const symbolsAfterUpdate = manager.getSymbolsByFile("test.ts");
    expect(symbolsAfterUpdate).toHaveLength(0);
  });
});

describe("SQLiteCache with Schema Versioning", () => {
  const testRoot = join(process.cwd(), "test-sqlite-cache-versioning");

  beforeEach(() => {
    mkdirSync(join(testRoot, ".lsmcp", "cache"), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it("should require reindexing after schema update", async () => {
    // Create initial cache
    let cache = new SQLiteCache(testRoot);
    expect(cache.requiresReindexing()).toBe(true); // First run
    cache.close();

    // Create new cache instance - should not require reindexing
    cache = new SQLiteCache(testRoot);
    expect(cache.requiresReindexing()).toBe(false);
    cache.close();

    // Simulate schema update
    const dbPath = join(testRoot, ".lsmcp", "cache", "symbols.db");
    const db = new DatabaseSync(dbPath);
    db.prepare("UPDATE schema_version SET version = 1").run();
    db.close();

    // Create new cache - should require reindexing
    cache = new SQLiteCache(testRoot);
    expect(cache.requiresReindexing()).toBe(true);

    // Cache get should return null when reindexing is required
    const testFile = join(testRoot, "test.ts");
    mkdirSync(testRoot, { recursive: true });
    writeFileSync(testFile, "const x = 1;");

    const result = await cache.get(testFile);
    expect(result).toBeNull();

    // Mark reindexing as complete
    cache.markReindexingComplete();
    expect(cache.requiresReindexing()).toBe(false);

    cache.close();
  });
});
