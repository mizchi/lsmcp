import { type Database as BetterSqlite3Database } from "better-sqlite3";

export type Position = { line: number; character: number };
export type Range = { start: Position; end: Position };
export type Location = { uri: string; range: Range };

function getDocId(
  db: BetterSqlite3Database,
  indexId: number,
  uri: string,
): number | null {
  const row = db
    .prepare("SELECT doc_id FROM documents WHERE index_id = ? AND uri = ?")
    .get(indexId, uri) as { doc_id: number } | undefined;
  return row?.doc_id ?? null;
}

function getDocUri(db: BetterSqlite3Database, docId: number): string | null {
  const row = db
    .prepare("SELECT uri FROM documents WHERE doc_id = ?")
    .get(docId) as { uri: string } | undefined;
  return row?.uri ?? null;
}

function getRangeSpan(
  db: BetterSqlite3Database,
  rangeId: number,
): Range | null {
  const row = db
    .prepare(
      "SELECT start_line, start_char, end_line, end_char FROM ranges WHERE range_id = ?",
    )
    .get(rangeId) as
    | {
        start_line: number;
        start_char: number;
        end_line: number;
        end_char: number;
      }
    | undefined;
  if (!row) return null;
  return {
    start: { line: row.start_line, character: row.start_char },
    end: { line: row.end_line, character: row.end_char },
  };
}

// 位置を内包する最小の range を取得（end は半開区間扱い: [start, end)）
function findInnermostRangeId(
  db: BetterSqlite3Database,
  docId: number,
  pos: Position,
): number | null {
  const row = db
    .prepare(
      `
SELECT range_id
FROM ranges
WHERE doc_id = ?
  AND (start_line < ? OR (start_line = ? AND start_char \u2264 ?))
  AND (end_line > ? OR (end_line = ? AND end_char > ?))
ORDER BY (end_line - start_line) ASC, (end_char - start_char) ASC
LIMIT 1
`,
    )
    .get(
      docId,
      pos.line,
      pos.line,
      pos.character,
      pos.line,
      pos.line,
      pos.character,
    ) as { range_id: number } | undefined;
  return row?.range_id ?? null;
}

function getResultSetIdForRange(
  db: BetterSqlite3Database,
  rangeId: number,
): number | null {
  const row = db
    .prepare("SELECT result_set_id FROM ranges WHERE range_id = ?")
    .get(rangeId) as { result_set_id: number | null } | undefined;
  return row?.result_set_id ?? null;
}

function getDefinitionsResultId(
  db: BetterSqlite3Database,
  resultSetId: number,
): number | null {
  const row = db
    .prepare(
      "SELECT definitions_result_id AS id FROM result_sets WHERE result_set_id = ?",
    )
    .get(resultSetId) as { id: number | null } | undefined;
  return row?.id ?? null;
}

function getReferencesResultId(
  db: BetterSqlite3Database,
  resultSetId: number,
): number | null {
  const row = db
    .prepare(
      "SELECT references_result_id AS id FROM result_sets WHERE result_set_id = ?",
    )
    .get(resultSetId) as { id: number | null } | undefined;
  return row?.id ?? null;
}

export function gotoDefinition(
  db: BetterSqlite3Database,
  docUri: string,
  line: number,
  character: number,
  indexId: number,
): Location[] {
  const docId = getDocId(db, indexId, docUri);
  if (docId == null) return [];
  const rangeId = findInnermostRangeId(db, docId, { line, character });
  if (rangeId == null) return [];

  const resultSetId = getResultSetIdForRange(db, rangeId);
  if (resultSetId == null) return [];

  const defResultId = getDefinitionsResultId(db, resultSetId);
  if (defResultId == null) return [];

  const items = db
    .prepare(
      "SELECT doc_id, range_id FROM definitions_items WHERE result_id = ?",
    )
    .all(defResultId) as Array<{ doc_id: number; range_id: number }>;

  return items
    .map(({ doc_id, range_id }) => {
      const uri = getDocUri(db, doc_id);
      const span = getRangeSpan(db, range_id);
      if (!uri || !span) return null;
      return { uri, range: span };
    })
    .filter((x): x is Location => x != null);
}

export function findReferences(
  db: BetterSqlite3Database,
  docUri: string,
  line: number,
  character: number,
  indexId: number,
  includeDefinitions = false,
): Location[] {
  const docId = getDocId(db, indexId, docUri);
  if (docId == null) return [];
  const rangeId = findInnermostRangeId(db, docId, { line, character });
  if (rangeId == null) return [];

  const resultSetId = getResultSetIdForRange(db, rangeId);
  if (resultSetId == null) return [];

  const refResultId = getReferencesResultId(db, resultSetId);
  if (refResultId == null) return [];

  let rows: Array<{ doc_id: number; range_id: number }>;
  if (includeDefinitions) {
    rows = db
      .prepare(
        "SELECT doc_id, range_id FROM references_items WHERE result_id = ?",
      )
      .all(refResultId) as Array<{ doc_id: number; range_id: number }>;
  } else {
    rows = db
      .prepare(
        "SELECT doc_id, range_id FROM references_items WHERE result_id = ? AND is_definition = 0",
      )
      .all(refResultId) as Array<{ doc_id: number; range_id: number }>;
  }

  return rows
    .map(({ doc_id, range_id }) => {
      const uri = getDocUri(db, doc_id);
      const span = getRangeSpan(db, range_id);
      if (!uri || !span) return null;
      return { uri, range: span };
    })
    .filter((x): x is Location => x != null);
}

export function hover(
  db: BetterSqlite3Database,
  docUri: string,
  line: number,
  character: number,
  indexId: number,
): string | null {
  const docId = getDocId(db, indexId, docUri);
  if (docId == null) return null;
  const rangeId = findInnermostRangeId(db, docId, { line, character });
  if (rangeId == null) return null;

  const row = db
    .prepare(
      `
SELECT h.contents AS contents
FROM ranges r
JOIN result_sets rs ON rs.result_set_id = r.result_set_id
JOIN hover_results h ON h.hover_id = rs.hover_result_id
WHERE r.range_id = ?
LIMIT 1
`,
    )
    .get(rangeId) as { contents: string } | undefined;

  return row?.contents ?? null;
}

export type SymbolHit = {
  symbolId: number;
  scheme: string;
  identifier: string;
  qualifiedName: string | null;
  kind: string | null;
  occurrences: number;
};

export function searchSymbols(
  db: BetterSqlite3Database,
  query: string,
  indexId: number,
  limit = 50,
): SymbolHit[] {
  // FTS5 の rank/bm25 は環境差があるため、まずは簡易な並び順にする
  const rows = db
    .prepare(
      `
WITH occ AS (
  SELECT symbol_id, COUNT(*) AS cnt
  FROM occurrences
  WHERE index_id = ?
  GROUP BY symbol_id
)
SELECT s.symbol_id AS symbolId,
       s.scheme AS scheme,
       s.identifier AS identifier,
       s.qualified_name AS qualifiedName,
       s.kind AS kind,
       COALESCE(occ.cnt, 0) AS occurrences
FROM symbol_fts f
JOIN symbols s ON s.symbol_id = f.rowid
LEFT JOIN occ ON occ.symbol_id = s.symbol_id
WHERE f MATCH ?
ORDER BY s.qualified_name ASC
LIMIT ?
`,
    )
    .all(indexId, query, limit) as SymbolHit[];

  return rows;
}
