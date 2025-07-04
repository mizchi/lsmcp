import { spawn } from "child_process";
import { join } from "path";
import { readFileSync } from "fs";
import { createLSPClient } from "../../src/lsp/lspClient.ts";
import type { LanguageConfig, LspAdapter } from "../../src/types.ts";
import { resolveAdapterCommand } from "../../src/adapters/utils.ts";
import {
  processDefaultDiagnostics,
  processDeduplicatedDiagnostics,
} from "./diagnosticProcessors.ts";
import {
  waitForDiagnosticsWithRetry,
  isLargeFile,
} from "../../src/lsp/diagnosticUtils.ts";

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

    const lspProcess = spawn(command, args, {
      cwd: projectPath,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Create LSP client
    const client = createLSPClient({
      rootPath: projectPath,
      process: lspProcess,
      languageId: adapter.baseLanguage,
      initializationOptions: config.initializationOptions,
    });

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

        // Use unified diagnostic wait logic
        const languageSpecific = {
          moonbit: { initialWait: 1000, maxPolls: 200, timeout: 5000 },
          deno: { initialWait: 800, maxPolls: 100, timeout: 3000 },
          default: isLargeFile(fileContent)
            ? { initialWait: 500, maxPolls: 100, timeout: 3000 }
            : { initialWait: 200, maxPolls: 60, timeout: 1000 },
        };

        const diagnostics = await waitForDiagnosticsWithRetry(
          client,
          fileUri,
          fileContent,
          adapter.baseLanguage,
          {
            forceRefresh: true,
            languageSpecific,
          },
        );

        // Filter to only errors and warnings
        const errorAndWarningDiagnostics = diagnostics.filter(
          (d: any) => d.severity === 1 || d.severity === 2,
        );

        // Use adapter-specific diagnostic processor if needed
        let processedDiagnostics;
        // Process diagnostics based on adapter configuration
        if (adapter.needsDiagnosticDeduplication) {
          processedDiagnostics = processDeduplicatedDiagnostics(
            errorAndWarningDiagnostics,
            checkFile,
            fileContent,
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
