import { ChildProcess, spawn } from "child_process";
import { createLSPClient } from "../../lsp/lspClient.ts";
import type { LSPClient } from "../../lsp/lspTypes.ts";
import { findTypescriptLanguageServer } from "../../ts/utils/findTypescriptLanguageServer.ts";
import { errors } from "../pure/errors/index.ts";

export interface LSPClientInstance {
  client: LSPClient;
  process: ChildProcess;
}

/**
 * Create a TypeScript LSP client instance
 * @param root Project root directory
 * @returns LSPClientInstance with client and process
 */
export async function createTypescriptLSPClient(
  root: string,
): Promise<LSPClientInstance> {
  // Try to find typescript-language-server binary
  let tsServerPath =
    process.env.TYPESCRIPT_LANGUAGE_SERVER_PATH ||
    findTypescriptLanguageServer(root);

  // If not found in the current root, try from the project root if specified
  if (!tsServerPath && process.env.LSMCP_PROJECT_ROOT) {
    tsServerPath = findTypescriptLanguageServer(process.env.LSMCP_PROJECT_ROOT);
  }

  // Check LSP_COMMAND environment variable
  if (!tsServerPath && process.env.LSP_COMMAND) {
    tsServerPath = process.env.LSP_COMMAND.split(" ")[0];
  }

  let args: string[];

  if (!tsServerPath) {
    // As a last resort, use npx (but this is slow)
    tsServerPath = "npx";
    args = ["typescript-language-server", "--stdio"];
  } else {
    args = ["--stdio"];
  }

  const lspProcess = spawn(tsServerPath, args, {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const client = createLSPClient({
    rootPath: root,
    process: lspProcess,
    languageId: "typescript",
  });

  try {
    await client.start();
    return { client, process: lspProcess };
  } catch (error) {
    // Clean up process if start fails
    if (!lspProcess.killed) {
      lspProcess.kill();
    }
    throw errors.lspStartError("typescript", String(error));
  }
}

/**
 * Safely stop an LSP client and its process
 * @param clientInstance The LSP client instance to stop
 */
export async function stopLSPClient(
  clientInstance: LSPClientInstance,
): Promise<void> {
  const { client, process: lspProcess } = clientInstance;

  try {
    await client.stop();
  } finally {
    // Ensure process is cleaned up even if stop fails
    try {
      if (lspProcess && !lspProcess.killed) {
        lspProcess.kill();
      }
    } catch {
      // Ignore errors during cleanup
    }
  }
}

/**
 * Open a document in the LSP client
 * @param client The LSP client
 * @param fileUri The file URI
 * @param content The file content
 * @param languageId The language ID (default: "typescript")
 */
export function openDocument(
  client: LSPClient,
  fileUri: string,
  content: string,
  languageId: string = "typescript",
): void {
  client.openDocument(fileUri, content, languageId);
}

/**
 * Wait for LSP to process a document
 * @param delay Delay in milliseconds (default: 1000)
 * @deprecated Use waitForDocumentProcessed instead for more efficient waiting
 */
export async function waitForLSP(delay: number = 1000): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Wait for a document to be processed by the LSP server
 * @param client The LSP client
 * @param fileUri The file URI to wait for
 * @param timeout Maximum time to wait in milliseconds (default: 2000)
 */
export async function waitForDocumentProcessed(
  client: LSPClient,
  fileUri: string,
  timeout: number = 2000,
): Promise<void> {
  const startTime = Date.now();

  // First, give the server a small amount of time to start processing
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Try to wait for diagnostics as a signal that the document is processed
  try {
    await client.waitForDiagnostics(fileUri, Math.max(timeout - 100, 100));
  } catch {
    // If no diagnostics, wait a bit more to ensure processing
    const elapsed = Date.now() - startTime;
    const remainingTime = Math.max(timeout - elapsed, 0);
    if (remainingTime > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(remainingTime, 200)),
      );
    }
  }
}
