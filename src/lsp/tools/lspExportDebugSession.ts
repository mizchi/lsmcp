import { z } from "zod";
import { err, ok, type Result } from "neverthrow";
import { createLSPTool } from "../../core/io/toolFactory.ts";
import {
  defaultGetSession as getSession,
  defaultExportSession as exportSession,
  defaultExportSessionText as exportSessionText,
} from "../debugLogger.ts";

const schema = z.object({
  sessionId: z
    .string()
    .optional()
    .describe("Debug session ID (default: current session)"),
  format: z
    .enum(["json", "text"])
    .optional()
    .describe("Export format (default: text)"),
});

type ExportDebugSessionRequest = z.infer<typeof schema>;

interface ExportDebugSessionSuccess {
  sessionId: string;
  format: "json" | "text";
  data: string;
  summary: {
    adapter: string;
    duration?: number;
    totalRequests: number;
    failedRequests: number;
    averageResponseTime: number;
  };
}

/**
 * Export debug session data
 */
async function exportDebugSession(
  request: ExportDebugSessionRequest,
): Promise<Result<ExportDebugSessionSuccess, string>> {
  try {
    const format = request.format || "text";

    // Get session
    const session = getSession(request.sessionId);
    if (!session) {
      return err(`Debug session not found: ${request.sessionId || "current"}`);
    }

    // Export data
    const data =
      format === "json"
        ? exportSession(session.sessionId)
        : exportSessionText(session.sessionId);

    // Calculate duration
    const duration = session.endTime
      ? session.endTime.getTime() - session.startTime.getTime()
      : Date.now() - session.startTime.getTime();

    const result: ExportDebugSessionSuccess = {
      sessionId: session.sessionId,
      format,
      data,
      summary: {
        adapter: session.adapter,
        duration,
        totalRequests: session.metrics.totalRequests,
        failedRequests: session.metrics.failedRequests,
        averageResponseTime: session.metrics.averageResponseTime,
      },
    };

    return ok(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return err(`Failed to export debug session: ${errorMessage}`);
  }
}

export const lspExportDebugSessionTool = createLSPTool({
  name: "export_debug_session",
  description: "Export debug session data for analysis",
  schema,
  language: "lsp",
  handler: exportDebugSession,
  formatSuccess: (result) => {
    const lines: string[] = [];

    lines.push(`=== Debug Session Export ===`);
    lines.push(`Session ID: ${result.sessionId}`);
    lines.push(`Format: ${result.format}`);
    lines.push(`Adapter: ${result.summary.adapter}`);

    if (result.summary.duration) {
      lines.push(`Duration: ${result.summary.duration}ms`);
    }

    lines.push(`Total Requests: ${result.summary.totalRequests}`);
    lines.push(`Failed Requests: ${result.summary.failedRequests}`);
    lines.push(
      `Average Response Time: ${result.summary.averageResponseTime.toFixed(
        1,
      )}ms`,
    );

    lines.push(`\n=== Session Data ===`);
    lines.push(result.data);

    return lines.join("\n");
  },
});
