import { DatabaseSync, type StatementSync } from "node:sqlite";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
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
import type { SymbolEntry } from "../../mcp/analysis/symbolIndex.ts";

// Current schema version
const SCHEMA_VERSION = 2;

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

    if (currentVersion < SCHEMA_VERSION) {
      // Need to update schema
      console.log(
        `Updating schema from version ${currentVersion} to ${SCHEMA_VERSION}`,
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
        
        CREATE INDEX IF NOT EXISTS idx_symbols_container 
          ON symbols(containerName, projectRoot);
      `);

      // Update schema version
      this.db
        .prepare(
          "INSERT OR REPLACE INTO schema_version (version, updated_at) VALUES (?, ?)",
        )
        .run(SCHEMA_VERSION, Date.now());
    }
  }

  async cacheSymbols(
    filePath: string,
    symbols: SymbolEntry[],
    lastModified: number,
  ): Promise<void> {
    // Start transaction
    this.db.exec("BEGIN TRANSACTION");

    try {
      // Delete existing symbols for this file
      this.deleteByFileStmt.run(filePath, this.rootPath);

      // Insert new symbols
      for (const symbol of symbols) {
        this.insertSymbol(filePath, symbol, lastModified);
      }

      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private insertSymbol(
    filePath: string,
    symbol: SymbolEntry,
    lastModified: number,
  ): void {
    this.insertStmt.run(
      filePath,
      symbol.name,
      symbol.kind,
      symbol.containerName || null,
      symbol.location.range.start.line,
      symbol.location.range.start.character,
      symbol.location.range.end.line,
      symbol.location.range.end.character,
      lastModified,
      this.rootPath,
    );

    // Recursively insert children
    if (symbol.children) {
      for (const child of symbol.children) {
        this.insertSymbol(filePath, child, lastModified);
      }
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
    const searchPattern = `*${pattern}*`;
    const rows = this.searchStmt.all(
      this.rootPath,
      searchPattern,
    ) as unknown as CachedSymbol[];
    return rows;
  }

  invalidateFile(filePath: string): void {
    this.deleteByFileStmt.run(filePath, this.rootPath);
  }

  clearCache(): void {
    const stmt = this.db.prepare(`DELETE FROM symbols WHERE projectRoot = ?`);
    stmt.run(this.rootPath);
  }

  close(): void {
    // Statements don't have finalize method in node:sqlite
    this.db.close();
  }

  getStats(): { totalSymbols: number; totalFiles: number } {
    const result = this.db
      .prepare(`
      SELECT 
        COUNT(*) as totalSymbols,
        COUNT(DISTINCT filePath) as totalFiles
      FROM symbols
      WHERE projectRoot = ?
    `)
      .get(this.rootPath) as any;

    return {
      totalSymbols: result.totalSymbols || 0,
      totalFiles: result.totalFiles || 0,
    };
  }

  /**
   * Check if schema was updated during initialization
   */
  wasSchemaUpdated(): boolean {
    return this.schemaUpdated;
  }

  /**
   * Get current schema version
   */
  getSchemaVersion(): number {
    return SCHEMA_VERSION;
  }
}
