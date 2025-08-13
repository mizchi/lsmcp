import Database from "better-sqlite3";
import type { Database as BetterSqlite3Database } from "better-sqlite3";

export type DB = BetterSqlite3Database;

export type IndexRunMeta = {
  repo?: string;
  commit?: string;
  createdAt?: string | Date;
};

export function openDb(filePath: string): DB {
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("temp_store = MEMORY");
  db.pragma("foreign_keys = ON");
  return db;
}

const SCHEMA = `
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS index_runs (
  index_id     INTEGER PRIMARY KEY,
  repo         TEXT,
  commit       TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  doc_id       INTEGER PRIMARY KEY,
  index_id     INTEGER NOT NULL REFERENCES index_runs(index_id) ON DELETE CASCADE,
  uri          TEXT NOT NULL,
  language_id  TEXT,
  UNIQUE(index_id, uri)
);

CREATE INDEX IF NOT EXISTS idx_documents_index_uri ON documents(index_id, uri);

CREATE TABLE IF NOT EXISTS result_sets (
  result_set_id                   INTEGER PRIMARY KEY,
  moniker_id                      INTEGER,
  definitions_result_id           INTEGER,
  references_result_id            INTEGER,
  type_definitions_result_id      INTEGER,
  implementations_result_id       INTEGER,
  hover_result_id                 INTEGER
);

CREATE TABLE IF NOT EXISTS ranges (
  range_id      INTEGER PRIMARY KEY,
  doc_id        INTEGER NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
  start_line    INTEGER NOT NULL,
  start_char    INTEGER NOT NULL,
  end_line      INTEGER NOT NULL,
  end_char      INTEGER NOT NULL,
  result_set_id INTEGER,
  FOREIGN KEY(result_set_id) REFERENCES result_sets(result_set_id)
);

CREATE INDEX IF NOT EXISTS idx_ranges_doc_pos
  ON ranges(doc_id, start_line, end_line, start_char, end_char);
CREATE INDEX IF NOT EXISTS idx_ranges_result_set
  ON ranges(result_set_id);

CREATE TABLE IF NOT EXISTS definitions_items (
  result_id   INTEGER NOT NULL,
  doc_id      INTEGER NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
  range_id    INTEGER NOT NULL REFERENCES ranges(range_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_defs_result ON definitions_items(result_id);
CREATE INDEX IF NOT EXISTS idx_defs_doc_range ON definitions_items(doc_id, range_id);

CREATE TABLE IF NOT EXISTS references_items (
  result_id      INTEGER NOT NULL,
  doc_id         INTEGER NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
  range_id       INTEGER NOT NULL REFERENCES ranges(range_id) ON DELETE CASCADE,
  is_definition  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_refs_result_def ON references_items(result_id, is_definition);
CREATE INDEX IF NOT EXISTS idx_refs_doc_range ON references_items(doc_id, range_id);

CREATE TABLE IF NOT EXISTS hover_results (
  hover_id  INTEGER PRIMARY KEY,
  contents  TEXT
);

CREATE TABLE IF NOT EXISTS packages (
  package_id INTEGER PRIMARY KEY,
  name       TEXT,
  version    TEXT,
  manager    TEXT
);

CREATE TABLE IF NOT EXISTS monikers (
  moniker_id INTEGER PRIMARY KEY,
  scheme     TEXT NOT NULL,
  identifier TEXT NOT NULL,
  kind       TEXT,
  package_id INTEGER,
  UNIQUE(scheme, identifier)
);

CREATE INDEX IF NOT EXISTS idx_monikers_key ON monikers(scheme, identifier);

CREATE TABLE IF NOT EXISTS symbols (
  symbol_id      INTEGER PRIMARY KEY,
  scheme         TEXT NOT NULL,
  identifier     TEXT NOT NULL,
  qualified_name TEXT,
  kind           TEXT,
  UNIQUE(scheme, identifier)
);

CREATE TABLE IF NOT EXISTS moniker_symbol (
  moniker_id INTEGER NOT NULL REFERENCES monikers(moniker_id) ON DELETE CASCADE,
  symbol_id  INTEGER NOT NULL REFERENCES symbols(symbol_id) ON DELETE CASCADE,
  UNIQUE(moniker_id)
);

CREATE TABLE IF NOT EXISTS occurrences (
  index_id  INTEGER NOT NULL REFERENCES index_runs(index_id) ON DELETE CASCADE,
  symbol_id INTEGER NOT NULL REFERENCES symbols(symbol_id) ON DELETE CASCADE,
  doc_id    INTEGER NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
  range_id  INTEGER NOT NULL REFERENCES ranges(range_id) ON DELETE CASCADE,
  role      TEXT NOT NULL CHECK(role IN ('definition','reference','implementation','type')),
  PRIMARY KEY(index_id, symbol_id, doc_id, range_id)
);

CREATE INDEX IF NOT EXISTS idx_occ_index_symbol ON occurrences(index_id, symbol_id);
CREATE INDEX IF NOT EXISTS idx_occ_doc_range    ON occurrences(doc_id, range_id);

-- FTS5 for symbol search
CREATE VIRTUAL TABLE IF NOT EXISTS symbol_fts
USING fts5(
  qualified_name,
  identifier,
  content='symbols',
  content_rowid='symbol_id'
);

-- Triggers to keep FTS in sync with symbols
CREATE TRIGGER IF NOT EXISTS trg_symbols_ai
AFTER INSERT ON symbols BEGIN
  INSERT INTO symbol_fts(rowid, qualified_name, identifier)
  VALUES (new.symbol_id, new.qualified_name, new.identifier);
END;

CREATE TRIGGER IF NOT EXISTS trg_symbols_ad
AFTER DELETE ON symbols BEGIN
  INSERT INTO symbol_fts(symbol_fts, rowid, qualified_name, identifier)
  VALUES ('delete', old.symbol_id, old.qualified_name, old.identifier);
END;

CREATE TRIGGER IF NOT EXISTS trg_symbols_au
AFTER UPDATE OF qualified_name, identifier ON symbols BEGIN
  INSERT INTO symbol_fts(symbol_fts, rowid, qualified_name, identifier)
  VALUES ('delete', old.symbol_id, old.qualified_name, old.identifier);
  INSERT INTO symbol_fts(rowid, qualified_name, identifier)
  VALUES (new.symbol_id, new.qualified_name, new.identifier);
END;
`;

export function migrate(db: DB): void {
  db.exec(SCHEMA);
}
