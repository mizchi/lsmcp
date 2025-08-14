/**
 * Helper functions for LSP integration tests
 */

import { ChildProcess, spawn } from "child_process";
import { join, dirname, resolve } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import type { LSPClient } from "@internal/lsp-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

export interface LSPTestSetup {
  lspProcess: ChildProcess;
  lspClient: LSPClient;
}

/**
 * Start an LSP server and create a client for testing
 */
export async function setupLSPForTesting(
  workingDir: string,
  languageId: string = "typescript",
): Promise<LSPTestSetup> {
  // Resolve typescript-language-server executable from node_modules/.bin
  const tsLspPath = join(
    projectRoot,
    "node_modules",
    ".bin",
    "typescript-language-server",
  );
  if (!existsSync(tsLspPath)) {
    throw new Error(
      `typescript-language-server not found at ${tsLspPath}. Please run 'pnpm install' first.`,
    );
  }

  console.log(`Starting LSP server: ${tsLspPath} in ${workingDir}`);

  // Start TypeScript language server directly
  const lspProcess = spawn(tsLspPath, ["--stdio"], {
    cwd: workingDir,
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Monitor process startup for debugging
  let stderrBuffer = "";

  lspProcess.on("error", (error) => {
    console.error("LSP process error:", error);
  });

  lspProcess.stderr?.on("data", (data) => {
    const output = data.toString();
    stderrBuffer += output;
    console.error("LSP stderr:", output);
  });

  const exitPromise = new Promise<never>((_, reject) => {
    lspProcess.once("exit", (code, signal) => {
      reject(
        new Error(
          `LSP process exited unexpectedly with code ${code}, signal ${signal}\nStderr: ${stderrBuffer}`,
        ),
      );
    });
  });

  // Initialize LSP client
  const { createLSPClient } = await import("@internal/lsp-client");
  const lspClient = createLSPClient({
    process: lspProcess,
    rootPath: workingDir,
    languageId,
  });

  try {
    // Race between initialization and process exit
    await Promise.race([lspClient.start(), exitPromise]);
    console.log("LSP client started successfully");

    // Clear exit handler after successful start
    lspProcess.removeAllListeners("exit");

    // Add logging-only exit handler
    lspProcess.on("exit", (code, signal) => {
      console.log(`LSP process exited with code ${code}, signal ${signal}`);
    });
  } catch (error) {
    console.error("Failed to start LSP client:", error);
    if (!lspProcess.killed) {
      lspProcess.kill();
    }
    throw error;
  }

  return { lspProcess, lspClient };
}

/**
 * Clean up LSP resources after testing
 */
export async function teardownLSP(setup: LSPTestSetup | null): Promise<void> {
  if (!setup) return;

  const { lspProcess, lspClient } = setup;

  try {
    if (lspClient) {
      await lspClient.stop();
    }
  } catch (error) {
    console.error("Error stopping LSP client:", error);
  }

  try {
    if (lspProcess && !lspProcess.killed) {
      lspProcess.kill();
      // Wait a bit for process to terminate
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error("Error killing LSP process:", error);
  }
}
