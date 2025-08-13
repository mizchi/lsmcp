import type { Readable } from "node:stream";
import readline from "node:readline";
import { type Database as BetterSqlite3Database } from "better-sqlite3";
import { migrate } from "./db.js";

export type IndexRunMeta = {
  repo?: string;
  commit?: string;
  createdAt?: string | Date;
};

type LsifBase = { id: number; type: "vertex" | "edge"; label: string };
type LsifVertex =
  | ({ type: "vertex"; label: "document" } & {
      uri: string;
      languageId?: string;
    })
  | ({ type: "vertex"; label: "range" } & {
      start: { line: number; character: number };
      end: { line: number; character: number };
    })
  | ({ type: "vertex"; label: "resultSet" } & Record<string, unknown>)
  | ({ type: "vertex"; label: "moniker" } & {
      scheme: string;
      identifier: string;
      kind?: string;
      packageInformationId?: number;
    })
  | ({ type: "vertex"; label: "hoverResult" } & { result: string })
  | ({ type: "vertex"; label: "packageInformation" } & {
      name: string;
      version?: string;
      manager?: string;
    });

type LsifEdge =
  | ({ type: "edge"; label: "contains" } & { outV: number; inVs: number[] })
  | ({ type: "edge"; label: "next" } & { outV: number; inV: number })
  | ({ type: "edge"; label: "moniker" } & { outV: number; inV: number })
  | ({
      type: "edge";
      label:
        | "textDocument/definition"
        | "textDocument/references"
        | "textDocument/typeDefinition"
        | "textDocument/implementation";
    } & {
      outV: number;
      inV: number;
    })
  | ({ type: "edge"; label: "item" } & {
      outV: number; // resultId
      inVs?: number[];
      inV?: number;
      // LSIF 0.4 item edges can carry a property indicating which bucket they belong to (definitions, references, declarations, etc.)
      property?: "definitions" | "references" | "declarations";
    });

type LsifElement = (LsifVertex | LsifEdge) & LsifBase;

export function createIndexRun(
  db: BetterSqlite3Database,
  meta: IndexRunMeta = {},
): number {
  const createdAt =
    typeof meta.createdAt === "string"
      ? meta.createdAt
      : meta.createdAt instanceof Date
        ? meta.createdAt.toISOString()
        : undefined;

  const stmt = db.prepare(
    `INSERT INTO index_runs (repo, commit, created_at) VALUES (?, ?, COALESCE(?, datetime('now')))`,
  );
  const info = stmt.run(
    meta.repo ?? null,
    meta.commit ?? null,
    createdAt ?? null,
  );
  return Number(info.lastInsertRowid);
}

function upsertSymbolForMoniker(
  db: BetterSqlite3Database,
  scheme: string,
  identifier: string,
  qualifiedName?: string | null,
  kind?: string | null,
): number {
  db.prepare(
    `INSERT INTO symbols (scheme, identifier, qualified_name, kind)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(scheme, identifier) DO NOTHING`,
  ).run(scheme, identifier, qualifiedName ?? null, kind ?? null);

  const row = db
    .prepare(
      `SELECT symbol_id FROM symbols WHERE scheme = ? AND identifier = ?`,
    )
    .get(scheme, identifier) as { symbol_id: number } | undefined;

  if (!row) throw new Error("Failed to upsert/select symbol");
  return row.symbol_id;
}

function linkMonikerToSymbol(
  db: BetterSqlite3Database,
  monikerId: number,
  symbolId: number,
) {
  db.prepare(
    `INSERT OR IGNORE INTO moniker_symbol (moniker_id, symbol_id) VALUES (?, ?)`,
  ).run(monikerId, symbolId);
}

function buildOccurrences(db: BetterSqlite3Database, indexId: number) {
  // definitions -> occurrences
  db.prepare(
    `
INSERT OR IGNORE INTO occurrences (index_id, symbol_id, doc_id, range_id, role)
SELECT ? as index_id, ms.symbol_id, di.doc_id, di.range_id, 'definition'
FROM definitions_items di
JOIN result_sets rs ON rs.definitions_result_id = di.result_id
JOIN moniker_symbol ms ON ms.moniker_id = rs.moniker_id
`,
  ).run(indexId);

  // references -> occurrences (include definitions flagged rows as definition)
  db.prepare(
    `
INSERT OR IGNORE INTO occurrences (index_id, symbol_id, doc_id, range_id, role)
SELECT ? as index_id, ms.symbol_id, ri.doc_id, ri.range_id,
       CASE WHEN ri.is_definition = 1 THEN 'definition' ELSE 'reference' END
FROM references_items ri
JOIN result_sets rs ON rs.references_result_id = ri.result_id
JOIN moniker_symbol ms ON ms.moniker_id = rs.moniker_id
`,
  ).run(indexId);
}

/**
 * ingestLsifStream
 * - 入力: NDJSON（1行1要素）の LSIF ストリーム
 * - 出力: 作成された index_id を返す
 */
export async function ingestLsifStream(
  readable: Readable,
  db: BetterSqlite3Database,
  meta: IndexRunMeta = {},
): Promise<number> {
  // 確実にスキーマを作成
  migrate(db);

  const indexId = createIndexRun(db, meta);

  // LSIF ID → DB Row ID のマップ
  const documentIdMap = new Map<number, number>();
  const rangeIdMap = new Map<number, number>();
  const resultSetIdMap = new Map<number, number>();
  const monikerIdMap = new Map<number, number>();
  const hoverIdMap = new Map<number, number>();
  const packageIdMap = new Map<number, number>();

  // 事前に使用する prepared statements
  const insertDocument = db.prepare(
    `INSERT INTO documents (index_id, uri, language_id) VALUES (?, ?, ?)`,
  );
  const insertRange = db.prepare(
    `INSERT INTO ranges (doc_id, start_line, start_char, end_line, end_char) VALUES (?, ?, ?, ?, ?)`,
  );
  const insertResultSet = db.prepare(`INSERT INTO result_sets DEFAULT VALUES`);
  const insertHover = db.prepare(
    `INSERT INTO hover_results (contents) VALUES (?)`,
  );
  const insertPackage = db.prepare(
    `INSERT INTO packages (name, version, manager) VALUES (?, ?, ?)`,
  );
  const insertMoniker = db.prepare(
    `INSERT INTO monikers (scheme, identifier, kind, package_id) VALUES (?, ?, ?, ?)`,
  );
  // const updateRangeDoc = db.prepare(`UPDATE ranges SET doc_id = ? WHERE range_id = ?`);
  const updateRangeNext = db.prepare(
    `UPDATE ranges SET result_set_id = ? WHERE range_id = ?`,
  );
  const updateRS_Def = db.prepare(
    `UPDATE result_sets SET definitions_result_id = ? WHERE result_set_id = ?`,
  );
  const updateRS_Ref = db.prepare(
    `UPDATE result_sets SET references_result_id = ? WHERE result_set_id = ?`,
  );
  const updateRS_TypeDef = db.prepare(
    `UPDATE result_sets SET type_definitions_result_id = ? WHERE result_set_id = ?`,
  );
  const updateRS_Impl = db.prepare(
    `UPDATE result_sets SET implementations_result_id = ? WHERE result_set_id = ?`,
  );
  // const updateRS_Hover = db.prepare(
  //   `UPDATE result_sets SET hover_result_id = ? WHERE result_set_id = ?`
  // );
  const updateRS_Moniker = db.prepare(
    `UPDATE result_sets SET moniker_id = ? WHERE result_set_id = ?`,
  );

  const insertDefItem = db.prepare(
    `INSERT INTO definitions_items (result_id, doc_id, range_id) VALUES (?, ?, ?)`,
  );
  const insertRefItem = db.prepare(
    `INSERT INTO references_items (result_id, doc_id, range_id, is_definition) VALUES (?, ?, ?, ?)`,
  );

  const rl = readline.createInterface({ input: readable, crlfDelay: Infinity });

  db.exec("BEGIN");
  try {
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let obj: LsifElement;
      try {
        obj = JSON.parse(trimmed) as LsifElement;
      } catch {
        // スキップ（壊れた行）
        continue;
      }

      if (obj.type === "vertex") {
        switch (obj.label) {
          case "document": {
            const v = obj as LsifVertex & { uri: string; languageId?: string };
            const info = insertDocument.run(
              indexId,
              v.uri,
              (v as any).languageId ?? null,
            );
            documentIdMap.set(obj.id, Number(info.lastInsertRowid));
            break;
          }
          case "range": {
            const v = obj as LsifVertex & {
              start: { line: number; character: number };
              end: { line: number; character: number };
            };
            // doc_id は contains エッジで後から埋まるため一旦仮 doc_id=0 のレコードは作らない。
            // SQLite 制約のため doc_id が必要なので、ここでは暫定的にダミー document を許容せず、後で contains で挿入する方式にすると複雑。
            // 代替: 仮に index 用の placeholder document を作らないため、ここは doc_id を NULL にできないので、
            // 先に "未紐付け range を一時保持" して contains を受けた時に INSERT する方式にする。
            // 実装簡略のため、ここでは doc_id を一旦 0 で入れ、後で contains で更新する（外部キーは documents(doc_id)=0 がないため不可）。
            // → 方針変更: range はここで一旦 doc_id=任意のダミーを挿入せず、メモリに保持し、contains で初めて INSERT する運用にする。
            pendingRanges.set(obj.id, {
              start_line: v.start.line,
              start_char: v.start.character,
              end_line: v.end.line,
              end_char: v.end.character,
            });
            break;
          }
          case "resultSet": {
            const info = insertResultSet.run();
            resultSetIdMap.set(obj.id, Number(info.lastInsertRowid));
            break;
          }
          case "hoverResult": {
            const v = obj as LsifVertex & { result: string };
            const info = insertHover.run(v.result);
            hoverIdMap.set(obj.id, Number(info.lastInsertRowid));
            break;
          }
          case "packageInformation": {
            const v = obj as LsifVertex & {
              name: string;
              version?: string;
              manager?: string;
            };
            const info = insertPackage.run(
              v.name,
              v.version ?? null,
              v.manager ?? null,
            );
            packageIdMap.set(obj.id, Number(info.lastInsertRowid));
            break;
          }
          case "moniker": {
            const v = obj as LsifVertex & {
              scheme: string;
              identifier: string;
              kind?: string;
              packageInformationId?: number;
            };
            const pkgId =
              v.packageInformationId != null
                ? (packageIdMap.get(v.packageInformationId) ?? null)
                : null;
            const info = insertMoniker.run(
              v.scheme,
              v.identifier,
              v.kind ?? null,
              pkgId ?? null,
            );
            const monikerRowId = Number(info.lastInsertRowid);
            monikerIdMap.set(obj.id, monikerRowId);

            // symbols を upsert し、moniker_symbol を張る
            const symbolId = upsertSymbolForMoniker(
              db,
              v.scheme,
              v.identifier,
              null,
              v.kind ?? null,
            );
            linkMonikerToSymbol(db, monikerRowId, symbolId);
            break;
          }
          default:
            // 未使用の頂点はスキップ
            break;
        }
      } else if (obj.type === "edge") {
        switch (obj.label) {
          case "contains": {
            const e = obj as LsifEdge & { outV: number; inVs: number[] };
            const docId = documentIdMap.get(e.outV);
            if (docId == null) break;

            // contains で初めて range を物理挿入
            for (const inV of e.inVs ?? []) {
              const pr = pendingRanges.get(inV);
              if (!pr) continue;
              const info = insertRange.run(
                docId,
                pr.start_line,
                pr.start_char,
                pr.end_line,
                pr.end_char,
              );
              pendingRanges.delete(inV);
              rangeIdMap.set(inV, Number(info.lastInsertRowid));
            }
            break;
          }
          case "next": {
            const e = obj as LsifEdge & { outV: number; inV: number };
            const rId = rangeIdMap.get(e.outV);
            const rsId = resultSetIdMap.get(e.inV);
            if (rId != null && rsId != null) {
              updateRangeNext.run(rsId, rId);
            }
            break;
          }
          case "textDocument/definition":
          case "textDocument/references":
          case "textDocument/typeDefinition":
          case "textDocument/implementation": {
            const e = obj as LsifEdge & { outV: number; inV: number };
            // outV は range or resultSet
            let rsId: number | undefined = resultSetIdMap.get(e.outV);
            if (rsId == null) {
              const rId = rangeIdMap.get(e.outV);
              if (rId != null) {
                const row = db
                  .prepare(
                    "SELECT result_set_id FROM ranges WHERE range_id = ?",
                  )
                  .get(rId) as { result_set_id: number | null } | undefined;
                rsId = row?.result_set_id ?? undefined;
              }
            }
            if (rsId == null) break;

            if (obj.label === "textDocument/definition") {
              updateRS_Def.run(e.inV, rsId);
            } else if (obj.label === "textDocument/references") {
              updateRS_Ref.run(e.inV, rsId);
            } else if (obj.label === "textDocument/typeDefinition") {
              updateRS_TypeDef.run(e.inV, rsId);
            } else if (obj.label === "textDocument/implementation") {
              updateRS_Impl.run(e.inV, rsId);
            }
            break;
          }
          case "moniker": {
            const e = obj as LsifEdge & { outV: number; inV: number };
            // outV は resultSet（または range のこともある）
            let rsId: number | undefined = resultSetIdMap.get(e.outV);
            if (rsId == null) {
              const rId = rangeIdMap.get(e.outV);
              if (rId != null) {
                const row = db
                  .prepare(
                    "SELECT result_set_id FROM ranges WHERE range_id = ?",
                  )
                  .get(rId) as { result_set_id: number | null } | undefined;
                rsId = row?.result_set_id ?? undefined;
              }
            }
            const mkId = monikerIdMap.get(e.inV);
            if (rsId != null && mkId != null) {
              updateRS_Moniker.run(mkId, rsId);
            }
            break;
          }
          case "item": {
            const e = obj as LsifEdge & {
              outV: number;
              inVs?: number[];
              inV?: number;
              property?: string;
            };
            const ranges = (e.inVs ??
              (e.inV != null ? [e.inV] : [])) as number[];
            if (ranges.length === 0) break;

            // ranges の物理IDを解決し、該当 document を取得
            const rows: Array<{ doc_id: number; range_id: number }> = [];
            for (const r of ranges) {
              const rid = rangeIdMap.get(r);
              if (rid == null) continue;
              const docRow = db
                .prepare("SELECT doc_id FROM ranges WHERE range_id = ?")
                .get(rid) as { doc_id: number } | undefined;
              if (!docRow) continue;
              rows.push({ doc_id: docRow.doc_id, range_id: rid });
            }

            // property に応じてどの items に入れるかを決定
            if (e.property === "definitions") {
              for (const row of rows)
                insertDefItem.run(e.outV, row.doc_id, row.range_id);
            } else if (e.property === "references" || e.property == null) {
              for (const row of rows)
                insertRefItem.run(e.outV, row.doc_id, row.range_id, 0);
            } else if (e.property === "declarations") {
              // declarations はここでは未使用。必要に応じて別テーブルに拡張
              for (const row of rows)
                insertRefItem.run(e.outV, row.doc_id, row.range_id, 0);
            }
            break;
          }
          default:
            // 未対応のエッジはスキップ
            break;
        }
      }
    }

    // hover は resultSet に結び付ける必要があるケースがある（LSIF により edge がある）
    // 上で textDocument/hover エッジを扱っていないため、簡易対応: result_sets.hover_result_id は edge 未対応のため将来拡張
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  // 派生テーブル occurrences を構築
  buildOccurrences(db, indexId);

  return indexId;
}

// 未挿入の range を保持して contains で挿入するための一時領域
type PendingRange = {
  start_line: number;
  start_char: number;
  end_line: number;
  end_char: number;
};
const pendingRanges = new Map<number, PendingRange>();
