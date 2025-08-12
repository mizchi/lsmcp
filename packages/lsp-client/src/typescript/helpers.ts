/**
 * TypeScript-specific LSP helpers
 */

import { createLSPClient, type LSPClient } from "../lspClient.ts";
import type { ChildProcess } from "child_process";
import { spawn } from "child_process";
// import { resolve } from "path";  // Currently unused

export interface TypescriptClientInstance {
  client: LSPClient;
  process: ChildProcess;
}

/**
 * Create a TypeScript LSP client
 */
export async function createTypescriptLSPClient(
  root: string,
): Promise<TypescriptClientInstance> {
  // Spawn TypeScript Language Server process
  const lspProcess = spawn("typescript-language-server", ["--stdio"], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Create LSP client
  const client = createLSPClient({
    rootPath: root,
    process: lspProcess,
    languageId: "typescript",
    initializationOptions: {
      preferences: {
        includeInlayParameterNameHints: "all",
        includeInlayParameterNameHintsWhenArgumentMatchesName: true,
        includeInlayFunctionParameterTypeHints: true,
        includeInlayVariableTypeHints: true,
        includeInlayPropertyDeclarationTypeHints: true,
        includeInlayFunctionLikeReturnTypeHints: true,
        includeInlayEnumMemberValueHints: true,
      },
    },
  });

  // Initialize the client
  await client.start();

  return { client, process: lspProcess };
}

/**
 * Open a document in the LSP client
 */
export function openDocument(
  client: LSPClient,
  fileUri: string,
  content: string,
): void {
  client.openDocument(fileUri, content, "typescript");
}

/**
 * Stop an LSP client
 */
export async function stopLSPClient(
  clientInstance: TypescriptClientInstance,
): Promise<void> {
  await clientInstance.client.stop();
}

/**
 * Wait for a document to be processed by the LSP server
 */
export async function waitForDocumentProcessed(
  _client: LSPClient,
  _fileUri: string,
  timeout: number = 1000,
): Promise<void> {
  // Wait for the document to be processed
  // This is a simple delay; more sophisticated implementations
  // could wait for specific LSP notifications
  await new Promise((resolve) => setTimeout(resolve, timeout));
}
