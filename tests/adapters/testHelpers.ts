import { spawn } from "child_process";
import { join } from "path";
import { readFileSync } from "fs";
import { createLSPClient } from "../../src/lsp/lspClient.ts";
import type { LanguageConfig, LspAdapter } from "../../src/types.ts";
import { resolveAdapterCommand } from "../../src/adapters/utils.ts";
import {
  processDefaultDiagnostics,
  processMoonbitDiagnostics,
  processTsgoDiagnostics,
} from "../../src/adapters/diagnosticProcessors.ts";

// Helper to convert adapter to language config
function adapterToLanguageConfig(adapter: LspAdapter): LanguageConfig {
  return {
    id: adapter.id,
    name: adapter.name,
    bin: adapter.bin,
    args: adapter.args,
    initializationOptions: adapter.initializationOptions,
  };
}

// Test helper to verify LSP connection
export async function testLspConnection(
  adapter: LspAdapter,
  projectPath: string,
  checkFiles: string[],
): Promise<{ connected: boolean; diagnostics?: any[]; error?: string }> {
  // Check doctor first if available
  if (adapter.doctor) {
    const doctorResult = await adapter.doctor();
    if (!doctorResult.ok) {
      return { connected: false, error: doctorResult.message };
    }
  }

  try {
    // Start LSP server
    const config = adapterToLanguageConfig(adapter);
    const { command, args } = resolveAdapterCommand(adapter, projectPath);

    // Debug log for pyright
    if (adapter.id === "pyright") {
      console.log(
        `[pyright] Starting LSP with command: ${command} ${args.join(" ")}`,
      );
      console.log(`[pyright] Working directory: ${projectPath}`);
    }

    const lspProcess = spawn(command, args, {
      cwd: projectPath,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Log stderr for debugging
    if (adapter.id === "pyright") {
      lspProcess.stderr?.on("data", (data) => {
        console.error(`[pyright] LSP stderr:`, data.toString());
      });

      lspProcess.on("error", (error) => {
        console.error(`[pyright] LSP process error:`, error);
      });

      lspProcess.on("exit", (code, signal) => {
        console.error(
          `[pyright] LSP process exited with code ${code}, signal ${signal}`,
        );
      });
    }

    // Create LSP client
    const client = createLSPClient({
      rootPath: projectPath,
      process: lspProcess,
      languageId: adapter.baseLanguage,
      initializationOptions: config.initializationOptions,
    });

    // Debug logging for pyright
    if (adapter.id === "pyright") {
      lspProcess.stderr?.on("data", (data) => {
        console.log(`[pyright stderr] ${data.toString()}`);
      });

      lspProcess.on("exit", (code) => {
        console.log(`[pyright] Process exited with code ${code}`);
      });

      lspProcess.on("error", (err) => {
        console.log(`[pyright] Process error:`, err);
      });
    }

    // Start the client - this will throw if connection fails
    await client.start();

    // Connection successful - wait a bit for initialization
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));

    let allDiagnostics: any[] = [];

    // Open and check each file
    for (const checkFile of checkFiles) {
      const testFile = join(projectPath, checkFile);

      try {
        const fileContent = readFileSync(testFile, "utf8");
        const fileUri = `file://${testFile}`;

        // Check if document is already open and close it to force refresh
        const isAlreadyOpen = client.isDocumentOpen(fileUri);
        if (isAlreadyOpen) {
          client.closeDocument(fileUri);
          await new Promise<void>((resolve) => setTimeout(resolve, 50));
        }

        // Open document in LSP with current content
        client.openDocument(fileUri, fileContent, adapter.baseLanguage);

        // Force LSP to re-read the file by sending an update
        client.updateDocument(fileUri, fileContent, 2);

        // Language-specific wait times
        const isMoonBit = adapter.baseLanguage === "moonbit";
        const lineCount = fileContent.split("\n").length;
        const isLargeFile = lineCount > 100;

        // Try event-driven approach first
        let diagnostics: any[] = [];
        let usePolling = false;

        const eventTimeout = isMoonBit ? 5000 : (isLargeFile ? 3000 : 1000);

        try {
          // Wait for diagnostics with event-driven approach
          diagnostics = await client.waitForDiagnostics(fileUri, eventTimeout);
        } catch {
          // Event-driven failed, fall back to polling
          usePolling = true;
        }

        // Fallback to polling if event-driven didn't work
        if (
          usePolling || (diagnostics.length === 0 && !client.waitForDiagnostics)
        ) {
          // Initial wait for LSP to process the document
          const initialWait = isMoonBit ? 1000 : (isLargeFile ? 500 : 200);
          await new Promise<void>((resolve) =>
            setTimeout(resolve, initialWait)
          );

          // Try pull diagnostics first (LSP 3.17+)
          if (client.pullDiagnostics) {
            try {
              diagnostics = await client.pullDiagnostics(fileUri);
            } catch {
              // Fall back to polling if pull diagnostics is not supported
            }
          }

          // If still no diagnostics, poll for them
          if (diagnostics.length === 0) {
            const maxPolls = isMoonBit ? 200 : (isLargeFile ? 100 : 60);
            const pollInterval = 50;
            const minPollsForNoError = isMoonBit
              ? 100
              : (isLargeFile ? 60 : 40);

            for (let poll = 0; poll < maxPolls; poll++) {
              await new Promise<void>((resolve) =>
                setTimeout(resolve, pollInterval)
              );
              diagnostics = client.getDiagnostics(fileUri) || [];

              // Break early if we have diagnostics or after minimum polls
              if (diagnostics.length > 0 || poll >= minPollsForNoError) {
                break;
              }

              // Try updating document again after a few polls
              if (poll === 5 || poll === 10) {
                client.updateDocument(fileUri, fileContent, poll + 1);
              }
            }
          }
        }

        // Filter to only errors and warnings
        const errorAndWarningDiagnostics = diagnostics
          .filter((d: any) => d.severity === 1 || d.severity === 2);

        // Use adapter-specific diagnostic processor if needed
        let processedDiagnostics;
        if (adapter.id === "tsgo") {
          processedDiagnostics = processTsgoDiagnostics(
            errorAndWarningDiagnostics,
            checkFile,
            fileContent,
          );
        } else if (adapter.id === "moonbit-language-server") {
          processedDiagnostics = processMoonbitDiagnostics(
            errorAndWarningDiagnostics,
            checkFile,
            fileContent,
            projectPath,
          );
        } else {
          processedDiagnostics = processDefaultDiagnostics(
            errorAndWarningDiagnostics,
            checkFile,
            fileContent,
          );
        }

        allDiagnostics.push(...processedDiagnostics);

        // Always close the document to avoid caching issues
        client.closeDocument(fileUri);
      } catch (e) {
        console.log(
          `[${adapter.id}] Could not get diagnostics for ${checkFile}: ${e}`,
        );
      }
    }

    await client.stop();

    return { connected: true, diagnostics: allDiagnostics };
  } catch (error: any) {
    return { connected: false, error: error.message || String(error) };
  }
}
