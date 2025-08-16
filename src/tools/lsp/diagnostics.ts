import type { LSPClient } from "@internal/lsp-client";
import { z } from "zod";
import { err, ok, type Result } from "neverthrow";
import {
  getLanguageIdFromPath,
  log,
  LogLevel,
  waitForDiagnosticsWithRetry,
} from "@internal/lsp-client";
import { createLSPTool } from "./toolFactory.ts";
import { DiagnosticResultBuilder } from "@internal/types";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  relativePath: z
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
export async function getDiagnosticsWithLSPV2(
  request: GetDiagnosticsRequest,
  lspClient?: LSPClient,
): Promise<Result<GetDiagnosticsSuccess, string>> {
  const startTime = Date.now();
  const timeout = request.timeout || 5000;
  let attempts = 0;
  let method: "push" | "pull" | "polling" = "push";

  try {
    // Resolve file
    const fs = await import("fs/promises");
    const path = await import("path");
    const absolutePath = path.resolve(request.root, request.relativePath);
    const fileContent = await fs.readFile(absolutePath, "utf-8");
    const fileUri = `file://${absolutePath}`;

    // Get client from parameter or global state

    const client = lspClient;
    if (!client) {
      throw new Error("LSP client not provided");
    }
    const languageId = getLanguageIdFromPath(request.relativePath);

    // Check if document is already open
    const documentWasOpen = client.isDocumentOpen(fileUri);

    // Use unified diagnostic wait logic
    const diagnostics = await waitForDiagnosticsWithRetry(
      client,
      fileUri,
      fileContent,
      languageId || undefined,
      {
        timeout,
        forceRefresh: request.forceRefresh !== false,
      },
    );

    // Determine which method was used (for debug info)
    const diagnosticSupport = client.getDiagnosticSupport();
    if (diagnostics.length > 0) {
      if (diagnosticSupport.pushDiagnostics) {
        method = "push";
      } else if (
        diagnosticSupport.pullDiagnostics &&
        typeof client.pullDiagnostics === "function"
      ) {
        method = "pull";
      } else {
        method = "polling";
      }
    }
    attempts = Math.max(3, Math.floor((Date.now() - startTime) / 100));

    // Build result
    const builder = new DiagnosticResultBuilder(
      request.root,
      request.relativePath,
    );
    builder.addLSPDiagnostics(diagnostics);

    const totalTime = Date.now() - startTime;

    // Clean up - always close document if we opened it
    if (!documentWasOpen) {
      try {
        client.closeDocument(fileUri);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
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

    log(
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

/**
 * Create diagnostics tool with injected LSP client
 */
export function createDiagnosticsTool(client: LSPClient) {
  return createLSPTool({
    name: "lsp_get_diagnostics",
    description:
      "Get diagnostics (errors, warnings) for a specific file using LSP. Provides detailed error and warning information.",
    schema,
    language: "lsp",
    handler: (request) => getDiagnosticsWithLSPV2(request, client),
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
}

// Skip these tests - they require LSP server and should be run as integration tests
