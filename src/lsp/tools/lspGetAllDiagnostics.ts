import { z } from "zod";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { join } from "path";
import { minimatch } from "minimatch";
import type { ToolDef } from "../../mcp/_mcplib.ts";
import { getActiveClient } from "../lspClient.ts";
import { debug } from "../../mcp/_mcplib.ts";
import { pathToFileURL } from "url";

import { exec } from "child_process";

const execAsync = promisify(exec);

const schema = z.object({
  root: z.string().describe("Root directory for the project"),
  include: z
    .string()
    .optional()
    .describe("Glob pattern for files to include (e.g., 'src/**/*.ts')"),
  exclude: z
    .string()
    .optional()
    .describe("Glob pattern for files to exclude (e.g., 'node_modules/**')"),
  severityFilter: z
    .enum(["error", "warning", "all"])
    .optional()
    .default("all")
    .describe("Filter diagnostics by severity"),
});

type GetAllDiagnosticsRequest = z.infer<typeof schema>;

interface FileDiagnostic {
  filePath: string;
  diagnostics: Array<{
    severity: "error" | "warning" | "information" | "hint";
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    message: string;
    source?: string;
    code?: string | number;
  }>;
}

interface GetAllDiagnosticsSuccess {
  message: string;
  totalErrors: number;
  totalWarnings: number;
  files: FileDiagnostic[];
}

// LSP Diagnostic severity mapping
const SEVERITY_MAP: Record<
  number,
  "error" | "warning" | "information" | "hint"
> = {
  1: "error",
  2: "warning",
  3: "information",
  4: "hint",
};

/**
 * Get all project files using git ls-files or file system traversal
 */
async function getProjectFiles(
  root: string,
  include?: string,
  exclude?: string,
): Promise<string[]> {
  try {
    // Try using git ls-files first
    const { stdout } = await execAsync("git ls-files", { cwd: root });
    let files = stdout
      .split("\n")
      .filter((f: string) => f.trim().length > 0)
      .filter((f: string) => {
        // Filter by common source file extensions
        const ext = f.toLowerCase();
        return (
          ext.endsWith(".ts") ||
          ext.endsWith(".tsx") ||
          ext.endsWith(".js") ||
          ext.endsWith(".jsx") ||
          ext.endsWith(".mjs") ||
          ext.endsWith(".cjs")
        );
      });

    // Apply include pattern if provided
    if (include) {
      files = files.filter((f: string) => minimatch(f, include));
    }

    // Apply exclude pattern if provided
    if (exclude) {
      files = files.filter((f: string) => !minimatch(f, exclude));
    }

    // Also exclude common directories
    files = files.filter((f: string) =>
      !f.includes("node_modules/") && !f.includes(".git/")
    );

    return files;
  } catch (error) {
    debug("Failed to use git ls-files:", error);

    // Fallback: use glob to find files
    const { glob } = await import("glob");
    const pattern = include || "**/*.{ts,tsx,js,jsx,mjs,cjs}";

    try {
      const files = await glob(pattern, {
        cwd: root,
        ignore: exclude
          ? [exclude, "**/node_modules/**", "**/.git/**"]
          : ["**/node_modules/**", "**/.git/**"],
        nodir: true,
      });

      return files;
    } catch (globError) {
      debug("Failed to use glob:", globError);
      throw new Error(
        `Failed to list project files: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

/**
 * Gets diagnostics for all files in the project
 */
async function getAllDiagnosticsWithLSP(
  request: GetAllDiagnosticsRequest,
): Promise<GetAllDiagnosticsSuccess> {
  const client = getActiveClient();

  if (!client) {
    throw new Error("LSP client not initialized");
  }

  // Get all project files
  const files = await getProjectFiles(
    request.root,
    request.include,
    request.exclude,
  );

  debug(`[lspGetAllDiagnostics] Found ${files.length} files to check`);

  const fileDiagnostics: FileDiagnostic[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  // Process files in batches to avoid overwhelming the LSP server
  const BATCH_SIZE = 10;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (filePath) => {
        try {
          const absolutePath = join(request.root, filePath);
          const fileUri = pathToFileURL(absolutePath).toString();

          // Read file content
          const fileContent = await readFile(absolutePath, "utf-8");

          // Open document in LSP
          client.openDocument(fileUri, fileContent);

          // Wait a bit for LSP to process
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Get diagnostics
          const diagnostics = client.getDiagnostics(fileUri);

          if (diagnostics && diagnostics.length > 0) {
            const mappedDiagnostics = diagnostics
              .filter((d) => d && d.range) // Filter out invalid diagnostics
              .map((d) => ({
                severity: SEVERITY_MAP[d.severity || 2] || "warning",
                line: d.range.start.line + 1, // Convert to 1-based
                column: d.range.start.character + 1, // Convert to 1-based
                endLine: d.range.end.line + 1,
                endColumn: d.range.end.character + 1,
                message: d.message,
                source: d.source,
                code: d.code,
              }))
              .filter((d) => {
                // Apply severity filter
                if (
                  request.severityFilter === "error" && d.severity !== "error"
                ) {
                  return false;
                }
                if (
                  request.severityFilter === "warning" &&
                  d.severity !== "warning"
                ) {
                  return false;
                }
                return true;
              });

            if (mappedDiagnostics.length > 0) {
              // Count errors and warnings
              mappedDiagnostics.forEach((d) => {
                if (d.severity === "error") totalErrors++;
                else if (d.severity === "warning") totalWarnings++;
              });

              fileDiagnostics.push({
                filePath,
                diagnostics: mappedDiagnostics,
              });
            }
          }

          // Close document to free memory
          client.closeDocument(fileUri);
        } catch (error) {
          debug(
            `[lspGetAllDiagnostics] Error processing file ${filePath}:`,
            error,
          );
        }
      }),
    );

    // Small delay between batches
    if (i + BATCH_SIZE < files.length) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // Sort files by path
  fileDiagnostics.sort((a, b) => a.filePath.localeCompare(b.filePath));

  return {
    message: `Found ${totalErrors} error${
      totalErrors !== 1 ? "s" : ""
    } and ${totalWarnings} warning${
      totalWarnings !== 1 ? "s" : ""
    } in ${fileDiagnostics.length} file${
      fileDiagnostics.length !== 1 ? "s" : ""
    }`,
    totalErrors,
    totalWarnings,
    files: fileDiagnostics,
  };
}

export const lspGetAllDiagnosticsTool: ToolDef<typeof schema> = {
  name: "lsmcp_get_all_diagnostics",
  description:
    "Get diagnostics (errors, warnings) for all files in the project",
  schema,
  execute: async (args: z.infer<typeof schema>) => {
    const result = await getAllDiagnosticsWithLSP(args);

    const messages = [result.message];

    if (result.files.length > 0) {
      messages.push("");
      for (const file of result.files) {
        messages.push(`${file.filePath}:`);
        for (const diag of file.diagnostics) {
          const prefix = diag.severity === "error" ? "  ❌" : "  ⚠️";
          messages.push(
            `${prefix} [${diag.severity}] Line ${diag.line}:${diag.column} - ${diag.message}`,
          );
        }
        messages.push("");
      }
    }

    return messages.join("\n");
  },
};
