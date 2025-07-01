import { ChildProcess, spawn } from "child_process";
import { createLSPClient } from "../lsp/lspClient.ts";
import { findTypescriptLanguageServer } from "../ts/utils/findTypescriptLanguageServer.ts";
import { MCPToolError } from "./mcpErrors.ts";

export interface LSPClientInstance {
  client: any; // LSP client type
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
  const tsServerPath = process.env.TYPESCRIPT_LANGUAGE_SERVER_PATH ||
    findTypescriptLanguageServer(root) ||
    process.env.LSP_COMMAND?.split(" ")[0] ||
    "typescript-language-server";

  const lspProcess = spawn(
    tsServerPath,
    ["--stdio"],
    {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

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
    throw new MCPToolError(
      `Failed to start TypeScript language server: ${error}`,
      "LSP_START_ERROR",
    );
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
  client: any,
  fileUri: string,
  content: string,
  languageId: string = "typescript",
): void {
  client.openDocument(fileUri, content, languageId);
}

/**
 * Wait for LSP to process a document
 * @param delay Delay in milliseconds (default: 1000)
 */
export async function waitForLSP(delay: number = 1000): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delay));
}
