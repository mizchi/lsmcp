import { DatabaseSync, type StatementSync } from "node:sqlite";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import type { SymbolEntry } from "../symbolIndex.ts";
import { SYMBOL_CACHE_SCHEMA_VERSION } from "@lsmcp/types";

// Define CachedSymbol type locally
export interface CachedSymbol {
  id?: number;
  filePath: string;
  namePath: string;
  kind: number;
  containerName?: string;
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
  lastModified: number;
  projectRoot: string;
}

export class SymbolCacheManager {
  private db: DatabaseSync;
  private insertStmt: StatementSync;
  private selectByFileStmt: StatementSync;
  private selectByNameStmt: StatementSync;
  private deleteByFileStmt: StatementSync;
  private searchStmt: StatementSync;
  private schemaUpdated = false;

  constructor(private rootPath: string) {
    const cacheDir = join(rootPath, ".lsmcp", "cache");
    const dbPath = join(cacheDir, "symbols.db");

    // Ensure cache directory exists
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }

    // Initialize database
    this.db = new DatabaseSync(dbPath);
    this.initializeDatabase();

    // Prepare statements
    this.insertStmt = this.db.prepare(`
      INSERT INTO symbols (
        filePath, namePath, kind, containerName, 
        startLine, startCharacter, endLine, endCharacter, 
        lastModified, projectRoot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.selectByFileStmt = this.db.prepare(`
      SELECT * FROM symbols 
      WHERE filePath = ? AND projectRoot = ?
      ORDER BY startLine, startCharacter
    `);

    this.selectByNameStmt = this.db.prepare(`
      SELECT * FROM symbols 
      WHERE namePath = ? AND projectRoot = ?
    `);

    this.deleteByFileStmt = this.db.prepare(`
      DELETE FROM symbols 
      WHERE filePath = ? AND projectRoot = ?
    `);

    this.searchStmt = this.db.prepare(`
      SELECT * FROM symbols 
      WHERE projectRoot = ? AND namePath GLOB ?
      ORDER BY filePath, startLine
    `);
  }

  private initializeDatabase(): void {
    // Create schema version table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        updated_at INTEGER NOT NULL
      );
    `);

    // Check current schema version
    const versionResult = this.db
      .prepare(
        "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1",
      )
      .get() as { version: number } | undefined;

    const currentVersion = versionResult?.version || 0;

    if (currentVersion < SYMBOL_CACHE_SCHEMA_VERSION) {
      // Need to update schema
      console.log(
        `Updating schema from version ${currentVersion} to ${SYMBOL_CACHE_SCHEMA_VERSION}`,
      );
      this.schemaUpdated = true;

      // Drop existing tables if schema is outdated
      if (currentVersion > 0) {
        this.db.exec(`DROP TABLE IF EXISTS symbols;`);
      }

      // Create symbols table with new schema
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS symbols (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filePath TEXT NOT NULL,
          namePath TEXT NOT NULL,
          kind INTEGER NOT NULL,
          containerName TEXT,
          startLine INTEGER NOT NULL,
          startCharacter INTEGER NOT NULL,
          endLine INTEGER NOT NULL,
          endCharacter INTEGER NOT NULL,
          lastModified INTEGER NOT NULL,
          projectRoot TEXT NOT NULL,
          UNIQUE(filePath, namePath, startLine, startCharacter, projectRoot)
        );
        
        CREATE INDEX IF NOT EXISTS idx_symbols_file 
        ON symbols(filePath, projectRoot);
        
        CREATE INDEX IF NOT EXISTS idx_symbols_name 
        ON symbols(namePath, projectRoot);
        
        CREATE INDEX IF NOT EXISTS idx_symbols_project 
        ON symbols(projectRoot);
      `);

      // Update schema version
      this.db.exec(`
        INSERT INTO schema_version (version, updated_at) 
        VALUES (${SYMBOL_CACHE_SCHEMA_VERSION}, ${Date.now()})
      `);
    } else {
      // Schema is up to date, just ensure tables exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS symbols (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filePath TEXT NOT NULL,
          namePath TEXT NOT NULL,
          kind INTEGER NOT NULL,
          containerName TEXT,
          startLine INTEGER NOT NULL,
          startCharacter INTEGER NOT NULL,
          endLine INTEGER NOT NULL,
          endCharacter INTEGER NOT NULL,
          lastModified INTEGER NOT NULL,
          projectRoot TEXT NOT NULL,
          UNIQUE(filePath, namePath, startLine, startCharacter, projectRoot)
        );
        
        CREATE INDEX IF NOT EXISTS idx_symbols_file 
        ON symbols(filePath, projectRoot);
        
        CREATE INDEX IF NOT EXISTS idx_symbols_name 
        ON symbols(namePath, projectRoot);
        
        CREATE INDEX IF NOT EXISTS idx_symbols_project 
        ON symbols(projectRoot);
      `);
    }
  }

  cacheSymbols(
    filePath: string,
    symbols: SymbolEntry[],
    lastModified: number,
  ): void {
    // Start transaction for better performance
    this.db.exec("BEGIN TRANSACTION");

    try {
      // Clear existing symbols for this file
      this.deleteByFileStmt.run(filePath, this.rootPath);

      // Insert new symbols
      const stack: Array<{ symbol: SymbolEntry; path: string }> = symbols.map(
        (s) => ({ symbol: s, path: s.name }),
      );

      while (stack.length > 0) {
        const item = stack.pop()!;
        const { symbol, path } = item;

        // Extract location info
        const { start, end } = symbol.location.range;

        this.insertStmt.run(
          filePath,
          path,
          symbol.kind,
          symbol.containerName || null,
          start.line,
          start.character,
          end.line,
          end.character,
          lastModified,
          this.rootPath,
        );

        // Process children
        if (symbol.children) {
          for (const child of symbol.children) {
            stack.push({
              symbol: child,
              path: `${path}/${child.name}`,
            });
          }
        }
      }

      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  getSymbolsByFile(filePath: string): CachedSymbol[] {
    const rows = this.selectByFileStmt.all(
      filePath,
      this.rootPath,
    ) as unknown as CachedSymbol[];
    return rows;
  }

  getSymbolsByName(namePath: string): CachedSymbol[] {
    const rows = this.selectByNameStmt.all(
      namePath,
      this.rootPath,
    ) as unknown as CachedSymbol[];
    return rows;
  }

  searchSymbols(pattern: string): CachedSymbol[] {
    // Convert user pattern to GLOB pattern
    const globPattern = pattern
      .replace(/\*/g, "*") // Keep wildcards
      .replace(/\?/g, "?"); // Keep single char wildcards

    const rows = this.searchStmt.all(
      this.rootPath,
      globPattern,
    ) as unknown as CachedSymbol[];
    return rows;
  }

  invalidateFile(filePath: string): void {
    this.deleteByFileStmt.run(filePath, this.rootPath);
  }

  clearCache(): void {
    this.db.exec("DELETE FROM symbols WHERE projectRoot = ?");
    this.db
      .prepare("DELETE FROM symbols WHERE projectRoot = ?")
      .run(this.rootPath);
  }

  getStats(): { totalSymbols: number; totalFiles: number } {
    const symbolCount = this.db
      .prepare("SELECT COUNT(*) as count FROM symbols WHERE projectRoot = ?")
      .get(this.rootPath) as { count: number };

    const fileCount = this.db
      .prepare(
        "SELECT COUNT(DISTINCT filePath) as count FROM symbols WHERE projectRoot = ?",
      )
      .get(this.rootPath) as { count: number };

    return {
      totalSymbols: symbolCount.count,
      totalFiles: fileCount.count,
    };
  }

  close(): void {
    this.db.close();
  }

  wasSchemaUpdated(): boolean {
    return this.schemaUpdated;
  }

  getSchemaVersion(): number {
    return SYMBOL_CACHE_SCHEMA_VERSION;
  }
}
