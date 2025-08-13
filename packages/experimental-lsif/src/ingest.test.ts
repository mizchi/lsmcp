import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { openDb } from "./db.js";
import { ingestLsifStream } from "./ingest.js";
import { gotoDefinition, findReferences, searchSymbols } from "./queries.js";

const uri = "file:///a.ts";

function ndjsonReadable(objs: any[]): Readable {
  const lines = objs.map((o) => JSON.stringify(o) + "\n");
  return Readable.from(lines);
}

test("ingest LSIF NDJSON and resolve definition/references + symbol search", async () => {
  const db = openDb(":memory:");

  // Minimal LSIF: one document, one definition range, one reference range, a shared references result,
  // and a moniker to enable symbol search/occurrences.
  const lsif = [
    // vertices
    { id: 1, type: "vertex", label: "document", uri, languageId: "typescript" },
    {
      id: 2,
      type: "vertex",
      label: "range",
      start: { line: 0, character: 4 },
      end: { line: 0, character: 10 },
    }, // def
    { id: 3, type: "vertex", label: "resultSet" },
    {
      id: 4,
      type: "vertex",
      label: "range",
      start: { line: 1, character: 0 },
      end: { line: 1, character: 6 },
    }, // ref
    { id: 5, type: "vertex", label: "resultSet" },
    {
      id: 6,
      type: "vertex",
      label: "moniker",
      scheme: "ts",
      identifier: "mySymbol",
      kind: "export",
    },
    // result vertices (not strictly required by our ingester, included for realism)
    { id: 10, type: "vertex", label: "definitionResult" },
    { id: 20, type: "vertex", label: "referenceResult" },

    // edges
    { id: 100, type: "edge", label: "contains", outV: 1, inVs: [2, 4] },
    { id: 101, type: "edge", label: "next", outV: 2, inV: 3 },
    { id: 102, type: "edge", label: "next", outV: 4, inV: 5 },
    { id: 103, type: "edge", label: "moniker", outV: 3, inV: 6 },

    // link resultSets to results
    {
      id: 110,
      type: "edge",
      label: "textDocument/definition",
      outV: 3,
      inV: 10,
    },
    {
      id: 111,
      type: "edge",
      label: "textDocument/references",
      outV: 3,
      inV: 20,
    },
    {
      id: 112,
      type: "edge",
      label: "textDocument/references",
      outV: 5,
      inV: 20,
    },

    // items: definitions and references
    {
      id: 120,
      type: "edge",
      label: "item",
      outV: 10,
      inVs: [2],
      property: "definitions",
    },
    { id: 121, type: "edge", label: "item", outV: 20, inVs: [2, 4] },
  ];

  const indexId = await ingestLsifStream(ndjsonReadable(lsif), db, {
    repo: "demo",
    commit: "abc",
  });

  // Go to Definition from inside definition range (0,5)
  {
    const defs = gotoDefinition(db, uri, 0, 5, indexId);
    assert.equal(defs.length, 1, "one definition should be found");
    const d = defs[0];
    assert.equal(d.uri, uri);
    assert.deepEqual(d.range, {
      start: { line: 0, character: 4 },
      end: { line: 0, character: 10 },
    });
  }

  // Find References from inside reference range (1,3)
  {
    const refs = findReferences(db, uri, 1, 3, indexId, false);
    assert.equal(
      refs.length,
      2,
      "both definition and reference were added to references result in this minimal fixture",
    );
    const uris = new Set(refs.map((r) => r.uri));
    assert(uris.has(uri));
  }

  // Symbol search via FTS
  {
    const hits = searchSymbols(db, "mySymbol", indexId, 10);
    assert.ok(hits.length >= 1, "at least one symbol hit expected");
    const first = hits[0];
    assert.equal(first.identifier, "mySymbol");
  }
});
