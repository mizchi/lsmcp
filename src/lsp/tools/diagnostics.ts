import { z } from "zod";
import { err, ok, type Result } from "neverthrow";
import { createLSPTool } from "../../core/io/toolFactory.ts";
import { resolveFileAndSymbol } from "../../core/io/fileSymbolResolver.ts";
import { DiagnosticResultBuilder } from "../../core/pure/resultBuilders.ts";
import { getActiveClient, getLanguageIdFromPath } from "../lspClient.ts";
import { defaultLog as log, LogLevel } from "../debugLogger.ts";
import { waitForDiagnosticsWithRetry } from "../diagnosticUtils.ts";

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
      } else if (diagnosticSupport.pullDiagnostics && client.pullDiagnostics) {
        method = "pull";
      } else {
        method = "polling";
      }
    }
    attempts = Math.max(3, Math.floor((Date.now() - startTime) / 100));

    // Build result
    const builder = new DiagnosticResultBuilder(request.root, request.filePath);
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

export const lspGetDiagnosticsTool = createLSPTool({
  name: "get_diagnostics",
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

if (import.meta.vitest) {
  const { describe, it, expect, beforeAll, afterAll } = import.meta.vitest;
  const { setupLSPForTest, teardownLSPForTest } = await import(
    "../testHelpers.ts"
  );
  const { default: path } = await import("path");

  describe("lspGetDiagnosticsTool", { timeout: 10000 }, () => {
    const root = path.resolve(import.meta.dirname, "../../..");

    beforeAll(async () => {
      await setupLSPForTest(root);
    });

    afterAll(async () => {
      await teardownLSPForTest();
    });

    it("should have correct tool definition", () => {
      expect(lspGetDiagnosticsTool.name).toBe("get_diagnostics");
      expect(lspGetDiagnosticsTool.description).toContain("diagnostics");
    });

    it("should handle non-existent file error", async () => {
      await expect(
        lspGetDiagnosticsTool.execute({
          root,
          filePath: "non-existent-file-12345.ts",
        }),
      ).rejects.toThrow("File not found");
    });
  });
}
