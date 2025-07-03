import { z } from "zod";
import { err, ok, type Result } from "neverthrow";
import { createLSPTool } from "../../core/io/toolFactory.ts";
import { resolveFileAndSymbol } from "../../core/io/fileSymbolResolver.ts";
import { DiagnosticResultBuilder } from "../../core/pure/resultBuilders.ts";
import { getActiveClient, getLanguageIdFromPath } from "../lspClient.ts";
import type { Diagnostic as LSPDiagnostic } from "../lspTypes.ts";
import { debugLogger, LogLevel } from "../debugLogger.ts";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path to check for diagnostics (relative to root)"),
  timeout: z
    .number()
    .optional()
    .describe("Timeout in milliseconds (default: 5000)"),
  forceRefresh: z
    .boolean()
    .optional()
    .describe("Force document refresh (default: true)"),
});

type GetDiagnosticsRequest = z.infer<typeof schema>;

interface GetDiagnosticsSuccess {
  message: string;
  diagnostics: Array<{
    severity: "error" | "warning" | "info" | "hint";
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    message: string;
    source?: string;
  }>;
  debug: {
    method: "push" | "pull" | "polling";
    attempts: number;
    totalTime: number;
    documentWasOpen: boolean;
  };
}

/**
 * Enhanced diagnostics with better error handling and debugging
 */
async function getDiagnosticsWithLSPV2(
  request: GetDiagnosticsRequest,
): Promise<Result<GetDiagnosticsSuccess, string>> {
  const startTime = Date.now();
  const timeout = request.timeout || 5000;
  let attempts = 0;
  let method: "push" | "pull" | "polling" = "push";

  debugLogger.log(
    LogLevel.DEBUG,
    "DiagnosticsV2",
    `Getting diagnostics for ${request.filePath}`,
  );

  try {
    // Resolve file
    const { fileContent, fileUri } = resolveFileAndSymbol({
      root: request.root,
      filePath: request.filePath,
    });

    const client = getActiveClient();
    const languageId = getLanguageIdFromPath(request.filePath);

    // Check if document is already open
    const documentWasOpen = client.isDocumentOpen(fileUri);

    if (documentWasOpen && request.forceRefresh !== false) {
      debugLogger.log(
        LogLevel.DEBUG,
        "DiagnosticsV2",
        "Closing existing document for refresh",
      );
      client.closeDocument(fileUri);
      // Allow time for cleanup
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }

    // Open document with fresh content
    debugLogger.log(
      LogLevel.DEBUG,
      "DiagnosticsV2",
      `Opening document with language: ${languageId}`,
    );
    client.openDocument(fileUri, fileContent, languageId || undefined);
    attempts++;

    let diagnostics: LSPDiagnostic[] = [];

    // Strategy 1: Try push diagnostics (event-driven)
    try {
      debugLogger.log(
        LogLevel.DEBUG,
        "DiagnosticsV2",
        "Trying push diagnostics",
      );

      const pushTimeout = Math.min(timeout * 0.6, 3000); // Use 60% of total timeout
      diagnostics = await client.waitForDiagnostics(fileUri, pushTimeout);
      method = "push";

      debugLogger.log(
        LogLevel.DEBUG,
        "DiagnosticsV2",
        `Push diagnostics success: ${diagnostics.length} diagnostics`,
      );
    } catch (error) {
      debugLogger.log(
        LogLevel.DEBUG,
        "DiagnosticsV2",
        `Push diagnostics failed: ${error}`,
      );

      // Strategy 2: Try pull diagnostics
      try {
        debugLogger.log(
          LogLevel.DEBUG,
          "DiagnosticsV2",
          "Trying pull diagnostics",
        );

        // Give LSP time to process
        await new Promise<void>((resolve) => setTimeout(resolve, 200));
        attempts++;

        diagnostics = await client.pullDiagnostics!(fileUri);
        method = "pull";

        debugLogger.log(
          LogLevel.DEBUG,
          "DiagnosticsV2",
          `Pull diagnostics success: ${diagnostics.length} diagnostics`,
        );
      } catch (pullError) {
        debugLogger.log(
          LogLevel.DEBUG,
          "DiagnosticsV2",
          `Pull diagnostics failed: ${pullError}`,
        );

        // Strategy 3: Polling fallback
        debugLogger.log(
          LogLevel.DEBUG,
          "DiagnosticsV2",
          "Falling back to polling",
        );
        method = "polling";

        const remainingTime = timeout - (Date.now() - startTime);
        const maxPolls = Math.max(10, Math.floor(remainingTime / 100));

        for (let poll = 0; poll < maxPolls; poll++) {
          await new Promise<void>((resolve) => setTimeout(resolve, 100));
          attempts++;

          diagnostics = client.getDiagnostics(fileUri) as LSPDiagnostic[];

          if (diagnostics.length > 0) {
            debugLogger.log(
              LogLevel.DEBUG,
              "DiagnosticsV2",
              `Polling success after ${poll + 1} attempts`,
            );
            break;
          }

          // Force document update every few polls
          if (poll > 0 && poll % 3 === 0) {
            debugLogger.log(
              LogLevel.DEBUG,
              "DiagnosticsV2",
              `Forcing document update (poll ${poll})`,
            );
            client.updateDocument(fileUri, fileContent, poll + 2);
          }

          // Check timeout
          if (Date.now() - startTime > timeout) {
            debugLogger.log(
              LogLevel.WARN,
              "DiagnosticsV2",
              "Polling timeout reached",
            );
            break;
          }
        }
      }
    }

    // Build result
    const builder = new DiagnosticResultBuilder(request.root, request.filePath);
    builder.addLSPDiagnostics(diagnostics);

    const totalTime = Date.now() - startTime;

    debugLogger.log(
      LogLevel.INFO,
      "DiagnosticsV2",
      `Completed: ${diagnostics.length} diagnostics via ${method} in ${totalTime}ms (${attempts} attempts)`,
    );

    // Clean up - always close document
    try {
      client.closeDocument(fileUri);
    } catch (cleanupError) {
      debugLogger.log(
        LogLevel.WARN,
        "DiagnosticsV2",
        `Cleanup error: ${cleanupError}`,
      );
    }

    const result = builder.build();
    return ok({
      ...result,
      debug: {
        method,
        attempts,
        totalTime,
        documentWasOpen,
      },
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    debugLogger.log(
      LogLevel.ERROR,
      "DiagnosticsV2",
      `Failed after ${totalTime}ms: ${errorMessage}`,
      undefined,
      error instanceof Error ? error : undefined,
    );

    return err(
      `Diagnostics failed: ${errorMessage} (${totalTime}ms, ${attempts} attempts)`,
    );
  }
}

export const lspGetDiagnosticsV2Tool = createLSPTool({
  name: "get_diagnostics_v2",
  description:
    "Get diagnostics (errors, warnings) for a file using enhanced LSP with debugging",
  schema,
  language: "lsp",
  handler: getDiagnosticsWithLSPV2,
  formatSuccess: (result) => {
    const messages = [
      result.message,
      `\nDebug Info: ${result.debug.method} method, ${result.debug.attempts} attempts, ${result.debug.totalTime}ms`,
    ];

    if (result.diagnostics.length > 0) {
      messages.push(`\nFound ${result.diagnostics.length} diagnostic(s):`);

      for (const diag of result.diagnostics) {
        const sourceInfo = diag.source ? ` (${diag.source})` : "";
        messages.push(
          `\n${diag.severity.toUpperCase()}: ${diag.message}${sourceInfo}\n` +
            `  at line ${diag.line}:${diag.column}`,
        );
      }
    } else {
      messages.push("\nNo diagnostics found.");
    }

    return messages.join("\n");
  },
});
