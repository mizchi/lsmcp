import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { applyWorkspaceEdit } from "./workspace.ts";
import { DocumentManager } from "./document-manager.ts";
import { nodeFileSystemApi } from "../utils/filesystem.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true });
});

function tempFile(name: string, content: string) {
  const dir = mkdtempSync(join(tmpdir(), "lsmcp ws #"));
  dirs.push(dir);
  const file = join(dir, name);
  writeFileSync(file, content);
  return { file, uri: pathToFileURL(file).toString() };
}

/** A DocumentManager plus a log of the notifications it sent */
function documents() {
  const sent: Array<{ method: string; params: unknown }> = [];
  const send = (method: string, params: unknown) =>
    sent.push({ method, params });
  return { manager: new DocumentManager(), send, sent };
}

const deleteFirstLine = {
  range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
  newText: "",
};

describe("applyWorkspaceEdit", () => {
  it("applies edits to a file whose path needs URI escaping", async () => {
    const { file, uri } = tempFile("a.ts", "let unused = 1;\nexport {};\n");
    expect(uri).toContain("%20");
    const { manager, send } = documents();

    const result = await applyWorkspaceEdit(
      { changes: { [uri]: [deleteFirstLine] } },
      nodeFileSystemApi,
      manager,
      send,
    );

    expect(result).toEqual({ applied: true });
    expect(readFileSync(file, "utf-8")).toBe("export {};\n");
  });

  it("reports documentChanges as not applied instead of ignoring them", async () => {
    const { manager, send } = documents();
    const result = await applyWorkspaceEdit(
      { documentChanges: [] },
      nodeFileSystemApi,
      manager,
      send,
    );

    expect(result).toEqual({
      applied: false,
      failureReason: "documentChanges is not supported",
    });
  });

  it("reports a failed write as not applied", async () => {
    const { manager, send } = documents();
    const result = await applyWorkspaceEdit(
      { changes: { "file:///nonexistent/dir/a.ts": [deleteFirstLine] } },
      nodeFileSystemApi,
      manager,
      send,
    );

    expect(result.applied).toBe(false);
    expect(result.failureReason).toMatch(/ENOENT/);
  });

  it("resends an open document's new content before returning", async () => {
    const { file, uri } = tempFile("a.ts", "let unused = 1;\nexport {};\n");
    const { manager, send, sent } = documents();
    manager.openDocument(uri, readFileSync(file, "utf-8"), send);

    const result = await applyWorkspaceEdit(
      { changes: { [uri]: [deleteFirstLine] } },
      nodeFileSystemApi,
      manager,
      send,
    );

    expect(result).toEqual({ applied: true });
    expect(sent.map((s) => s.method)).toEqual([
      "textDocument/didOpen",
      "textDocument/didChange",
    ]);
    expect(sent[1].params).toEqual({
      textDocument: { uri, version: 2 },
      contentChanges: [{ text: "export {};\n" }],
    });
  });

  it("edits the text the server was given, not the file on disk", async () => {
    const { file, uri } = tempFile("a.ts", "// on disk\n");
    const { manager, send, sent } = documents();
    manager.openDocument(uri, "let unused = 1;\nexport {};\n", send);

    const result = await applyWorkspaceEdit(
      { changes: { [uri]: [deleteFirstLine] } },
      nodeFileSystemApi,
      manager,
      send,
    );

    expect(result).toEqual({ applied: true });
    expect(readFileSync(file, "utf-8")).toBe("export {};\n");
    expect(sent[1].params).toMatchObject({
      contentChanges: [{ text: "export {};\n" }],
    });
    expect(manager.getDocumentText(uri)).toBe("export {};\n");
  });

  it("does not notify for documents that are not open", async () => {
    const { uri } = tempFile("a.ts", "let unused = 1;\nexport {};\n");
    const { manager, send, sent } = documents();

    await applyWorkspaceEdit(
      { changes: { [uri]: [deleteFirstLine] } },
      nodeFileSystemApi,
      manager,
      send,
    );

    expect(sent).toEqual([]);
  });

  it("writes nothing when a later file cannot be read", async () => {
    const { file, uri } = tempFile("a.ts", "let unused = 1;\nexport {};\n");
    const { manager, send, sent } = documents();
    manager.openDocument(uri, readFileSync(file, "utf-8"), send);

    const result = await applyWorkspaceEdit(
      {
        changes: {
          [uri]: [deleteFirstLine],
          "file:///nonexistent/dir/b.ts": [deleteFirstLine],
        },
      },
      nodeFileSystemApi,
      manager,
      send,
    );

    expect(result.applied).toBe(false);
    expect(readFileSync(file, "utf-8")).toBe("let unused = 1;\nexport {};\n");
    expect(sent.map((s) => s.method)).toEqual(["textDocument/didOpen"]);
  });

  it("notifies the documents written before a later write fails", async () => {
    const { file, uri } = tempFile("a.ts", "let unused = 1;\nexport {};\n");
    const { manager, send, sent } = documents();
    manager.openDocument(uri, readFileSync(file, "utf-8"), send);
    const unwritable = "file:///nonexistent/dir/b.ts";
    manager.openDocument(unwritable, "let unused = 1;\nexport {};\n", send);

    const result = await applyWorkspaceEdit(
      {
        changes: {
          [uri]: [deleteFirstLine],
          [unwritable]: [deleteFirstLine],
        },
      },
      nodeFileSystemApi,
      manager,
      send,
    );

    expect(result.applied).toBe(false);
    expect(result.failureReason).toMatch(/nonexistent/);
    expect(readFileSync(file, "utf-8")).toBe("export {};\n");
    expect(sent.slice(2)).toEqual([
      {
        method: "textDocument/didChange",
        params: {
          textDocument: { uri, version: 2 },
          contentChanges: [{ text: "export {};\n" }],
        },
      },
    ]);
    expect(manager.getDocumentText(unwritable)).toBe(
      "let unused = 1;\nexport {};\n",
    );
  });
});
