import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ChildProcess, spawn } from "child_process";
import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { fileURLToPath, pathToFileURL } from "url";
import type { CodeAction, Command, LSPClient } from "@internal/lsp-client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../..");

describe("server-initiated workspace/applyEdit", { timeout: 30000 }, () => {
  let lspProcess: ChildProcess;
  let lspClient: LSPClient;
  let tmpDir: string;

  beforeAll(async () => {
    const tsLspPath = path.join(
      projectRoot,
      "node_modules",
      ".bin",
      "typescript-language-server",
    );
    if (!existsSync(tsLspPath)) {
      throw new Error(`typescript-language-server not found at ${tsLspPath}`);
    }
    tmpDir = path.join(
      __dirname,
      `tmp-apply-edit-${randomBytes(8).toString("hex")}`,
    );
    await fs.mkdir(tmpDir, { recursive: true });
    lspProcess = spawn(tsLspPath, ["--stdio"], {
      cwd: tmpDir,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const { createLSPClient } = await import("@internal/lsp-client");
    lspClient = createLSPClient({
      process: lspProcess,
      rootPath: tmpDir,
      languageId: "typescript",
    });
    await lspClient.start();
  }, 30000);

  afterAll(async () => {
    if (lspClient) await lspClient.stop();
    lspProcess?.kill();
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  }, 30000);

  it("applies the edit that a code action's command makes the server request", async () => {
    const file = path.join(tmpDir, "greet.ts");
    const source =
      "export function greet(name: string): string {\n  return name;\n}\n";
    await fs.writeFile(file, source);
    const uri = pathToFileURL(file).toString();
    lspClient.openDocument(uri, source);

    // typescript-language-server returns refactorings as commands
    const range = {
      start: { line: 0, character: 0 },
      end: { line: 2, character: 1 },
    };
    let action: CodeAction | undefined;
    for (let attempt = 0; attempt < 20 && !action; attempt++) {
      const actions = await lspClient.getCodeActions(uri, range, {
        diagnostics: [],
      });
      action = actions.find(
        (a): a is CodeAction =>
          "title" in a &&
          a.title === "Convert named export to default export" &&
          "command" in a &&
          typeof a.command === "object",
      );
      if (!action) await new Promise((r) => setTimeout(r, 500));
    }
    expect(action?.command).toBeDefined();
    const command = action!.command as Command;

    // running the command makes the server send workspace/applyEdit
    const result = await lspClient.sendRequest("workspace/executeCommand", {
      command: command.command,
      arguments: command.arguments,
    });

    // the file is edited before the command resolves
    expect(result).toBeDefined();
    expect(await fs.readFile(file, "utf-8")).toBe(
      "export default function greet(name: string): string {\n  return name;\n}\n",
    );
  });
});
