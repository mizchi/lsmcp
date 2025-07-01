import { z } from "zod";
import { err, ok, type Result } from "neverthrow";
import { readFileSync } from "fs";
import path from "path";
import { getActiveClient } from "../lspClient.ts";
import type { ToolDef } from "../../mcp/_mcplib.ts";
import { getLanguageIdFromPath } from "../languageDetection.ts";

const schema = z.object({
  root: z.string().describe("Root directory for resolving relative paths"),
  filePath: z
    .string()
    .describe("File path to check for diagnostics (relative to root)"),
});

type GetDiagnosticsRequest = z.infer<typeof schema>;

interface Diagnostic {
  severity: "error" | "warning" | "information" | "hint";
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  source?: string;
  code?: string | number;
}

interface GetDiagnosticsSuccess {
  message: string;
  diagnostics: Diagnostic[];
}

// LSP Diagnostic severity mapping
const SEVERITY_MAP: Record<number, Diagnostic["severity"]> = {
  1: "error",
  2: "warning",
  3: "information",
  4: "hint",
};

interface LSPDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity?: number;
  code?: string | number;
  source?: string;
  message: string;
}

/**
 * Gets diagnostics for a TypeScript file using LSP
 */
async function getDiagnosticsWithLSP(
  request: GetDiagnosticsRequest,
): Promise<Result<GetDiagnosticsSuccess, string>> {
  try {
    const client = getActiveClient();

    // Read file content
    const absolutePath = path.resolve(request.root, request.filePath);
    const fileContent = readFileSync(absolutePath, "utf-8");
    const fileUri = `file://${absolutePath}`;

    // Check if document is already open and close it to force refresh
    const isAlreadyOpen = client.isDocumentOpen(fileUri);
    if (isAlreadyOpen) {
      client.closeDocument(fileUri);
      // Reduced wait time from 100ms to 50ms
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }

    // Detect language from file extension
    const languageId = getLanguageIdFromPath(request.filePath);
    const isMoonBit = languageId === "moonbit";

    // Open document in LSP with current content
    client.openDocument(fileUri, fileContent, languageId);

    // Force LSP to re-read the file by sending an update
    client.updateDocument(fileUri, fileContent, 2);

    // For MoonBit, give extra time for the LSP to process
    if (isMoonBit) {
      // MoonBit LSP might need more time to compile and analyze
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    }

    // Try event-driven approach first
    let lspDiagnostics: LSPDiagnostic[] = [];
    let usePolling = false;

    // Determine if this is a large file that might need more time
    const lineCount = fileContent.split("\n").length;
    const isLargeFile = lineCount > 100;
    // MoonBit needs more time to compile and produce diagnostics
    const eventTimeout = isMoonBit ? 5000 : (isLargeFile ? 3000 : 1000);

    // Check if pull diagnostics should be enabled
    const enablePullDiagnostics =
      process.env.ENABLE_PULL_DIAGNOSTICS === "true";

    try {
      // Wait for diagnostics with event-driven approach (shorter timeout for faster fallback)
      const diagnostics = await client.waitForDiagnostics(
        fileUri,
        eventTimeout,
      );
      lspDiagnostics = diagnostics as LSPDiagnostic[];
    } catch (error) {
      // Event-driven failed, fall back to polling
      usePolling = true;
    }

    // Fallback to polling if event-driven didn't work
    if (
      usePolling ||
      (lspDiagnostics.length === 0 && !client.waitForDiagnostics)
    ) {
      // Initial wait for LSP to process the document (important for CI)
      // MoonBit needs more time to compile
      const initialWait = isMoonBit ? 1000 : (isLargeFile ? 500 : 200);
      await new Promise<void>((resolve) => setTimeout(resolve, initialWait));

      // Try pull diagnostics first (LSP 3.17+) if explicitly enabled
      if (enablePullDiagnostics && client.pullDiagnostics) {
        try {
          lspDiagnostics = await client.pullDiagnostics(
            fileUri,
          ) as LSPDiagnostic[];
        } catch {
          // Fall back to polling if pull diagnostics is not supported
        }
      }

      // If still no diagnostics, poll for them
      if (lspDiagnostics.length === 0) {
        // Poll for diagnostics
        // MoonBit might need more time to compile and produce diagnostics
        const maxPolls = isMoonBit ? 200 : (isLargeFile ? 100 : 60); // Max 10 seconds for MoonBit
        const pollInterval = 50; // Poll every 50ms
        const minPollsForNoError = isMoonBit ? 100 : (isLargeFile ? 60 : 40); // More polls for MoonBit

        for (let poll = 0; poll < maxPolls; poll++) {
          await new Promise<void>((resolve) =>
            setTimeout(resolve, pollInterval)
          );
          lspDiagnostics = client.getDiagnostics(fileUri) as LSPDiagnostic[];

          // Break early if we have diagnostics or after minimum polls for no-error files
          if (lspDiagnostics.length > 0 || poll >= minPollsForNoError) {
            break;
          }

          // Try updating document again after a few polls
          if (poll === 5 || poll === 10) {
            client.updateDocument(fileUri, fileContent, poll + 1);
          }
        }
      }
    }

    // Convert LSP diagnostics to our format
    const diagnostics: Diagnostic[] = lspDiagnostics.map((diag) => ({
      severity: SEVERITY_MAP[diag.severity ?? 1] ?? "error",
      line: diag.range.start.line + 1, // Convert to 1-based
      column: diag.range.start.character + 1,
      endLine: diag.range.end.line + 1,
      endColumn: diag.range.end.character + 1,
      message: diag.message,
      source: diag.source,
      code: diag.code,
    }));

    const errorCount = diagnostics.filter((d) => d.severity === "error").length;
    const warningCount = diagnostics.filter(
      (d) => d.severity === "warning",
    ).length;

    // Always close the document to avoid caching issues
    client.closeDocument(fileUri);

    return ok({
      message: `Found ${errorCount} error${
        errorCount !== 1 ? "s" : ""
      } and ${warningCount} warning${
        warningCount !== 1 ? "s" : ""
      } in ${request.filePath}`,
      diagnostics,
    });
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

export const lspGetDiagnosticsTool: ToolDef<typeof schema> = {
  name: "get_diagnostics",
  description: "Get diagnostics (errors, warnings) for a file using LSP",
  schema,
  execute: async (args: z.infer<typeof schema>) => {
    const result = await getDiagnosticsWithLSP(args);
    if (result.isOk()) {
      const messages = [result.value.message];

      if (result.value.diagnostics.length > 0) {
        for (const diag of result.value.diagnostics) {
          const codeInfo = diag.code ? ` [${diag.code}]` : "";
          const sourceInfo = diag.source ? ` (${diag.source})` : "";
          messages.push(
            `\n${diag.severity.toUpperCase()}: ${diag.message}${codeInfo}${sourceInfo}\n` +
              `  at ${args.filePath}:${diag.line}:${diag.column}`,
          );
        }
      }

      return messages.join("\n\n");
    } else {
      throw new Error(result.error);
    }
  },
};

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
      ).rejects.toThrow("ENOENT");
    });
  });
}
