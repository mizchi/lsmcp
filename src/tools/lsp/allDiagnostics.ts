import type { LSPClient } from "@internal/lsp-client";
import { z } from "zod";
import { readFile } from "fs/promises";
import { join } from "path";
import { minimatch } from "minimatch";
import type { McpToolDef } from "@internal/types";
import { debug } from "@internal/lsp-client";
import { pathToFileURL } from "url";
import { Diagnostic } from "@internal/types";
import { glob as gitawareGlob } from "gitaware-glob";
import { glob as standardGlob } from "glob";
import {
  DIAGNOSTICS_BATCH_SIZE,
  MAX_FILES_TO_SHOW,
  MAX_DIAGNOSTICS_PER_FILE,
} from "../../constants/diagnostics.ts";

const schema = z.object({
  root: z.string().describe("Root directory for the project"),
  pattern: z
    .string()
    .describe(
      "Glob pattern for files to include (e.g., '**/*.ts' for TypeScript, '**/*.fs' for F#, '**/*.py' for Python)",
    ),
  exclude: z
    .string()
    .optional()
    .describe("Glob pattern for files to exclude (e.g., 'node_modules/**')"),
  severityFilter: z
    .enum(["error", "warning", "all"])
    .optional()
    .default("all")
    .describe("Filter diagnostics by severity"),
  useGitignore: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to respect .gitignore files (default: true)"),
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
 * Get all project files using gitaware-glob
 * This automatically respects .gitignore
 */
async function getProjectFiles(
  root: string,
  pattern: string,
  exclude?: string,
  useGitignore: boolean = true,
): Promise<string[]> {
  debug(
    `[lspGetAllDiagnostics] getProjectFiles called with root=${root}, pattern=${pattern}, exclude=${exclude}, useGitignore=${useGitignore}`,
  );

  try {
    let files: string[];

    if (useGitignore) {
      // Use gitaware-glob which automatically respects .gitignore
      const filesGen = await gitawareGlob(pattern, {
        cwd: root,
      });
      files = [];
      for await (const file of filesGen) {
        files.push(file);
      }
    } else {
      // Use standard glob when gitignore should be ignored
      files = await standardGlob(pattern, {
        cwd: root,
        nodir: true,
        ignore: ["**/node_modules/**", "**/.git/**"],
      });
    }

    debug(`[lspGetAllDiagnostics] Found ${files.length} files from glob`);

    let filteredFiles = files;

    // Apply exclude pattern if provided
    if (exclude) {
      filteredFiles = filteredFiles.filter(
        (f: string) => !minimatch(f, exclude),
      );
    }

    // Additional safety filter for common directories that should be excluded
    filteredFiles = filteredFiles.filter(
      (f: string) =>
        !f.includes("/obj/") && // Exclude build artifacts
        !f.includes("/bin/"), // Exclude build outputs
    );

    debug(
      `[lspGetAllDiagnostics] Total files to check: ${filteredFiles.length}`,
    );
    if (filteredFiles.length > 0) {
      debug(
        `[lspGetAllDiagnostics] File extensions found: ${[
          ...new Set(
            filteredFiles.map((f) => {
              const ext = f.lastIndexOf(".");
              return ext > 0 ? f.substring(ext) : "no-ext";
            }),
          ),
        ].join(", ")}`,
      );
    }
    return filteredFiles;
  } catch (error) {
    debug("Failed to use glob:", error);
    throw new Error(
      `Failed to list project files: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Gets diagnostics for all files in the project
 */
async function getAllDiagnosticsWithLSP(
  request: GetAllDiagnosticsRequest,
  client: LSPClient,
): Promise<GetAllDiagnosticsSuccess> {
  if (!client) {
    throw new Error("LSP client not initialized");
  }

  // Get all project files
  let files: string[];
  try {
    files = await getProjectFiles(
      request.root,
      request.pattern,
      request.exclude,
      request.useGitignore ?? true,
    );
    debug(
      `[lspGetAllDiagnostics] getProjectFiles returned ${files.length} files`,
    );
  } catch (error) {
    debug(`[lspGetAllDiagnostics] Error in getProjectFiles:`, error);
    throw error;
  }

  debug(`[lspGetAllDiagnostics] Found ${files.length} files to check`);

  const fileDiagnostics: FileDiagnostic[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  // Process files in batches to avoid overwhelming the LSP server
  for (let i = 0; i < files.length; i += DIAGNOSTICS_BATCH_SIZE) {
    const batch = files.slice(i, i + DIAGNOSTICS_BATCH_SIZE);

    await Promise.all(
      batch.map(async (filePath) => {
        try {
          const absolutePath = join(request.root, filePath);
          const fileUri = pathToFileURL(absolutePath).toString();

          // Read file content
          let fileContent: string;
          try {
            fileContent = await readFile(absolutePath, "utf-8");
          } catch (readError) {
            debug(
              `[lspGetAllDiagnostics] Failed to read file ${filePath}:`,
              readError,
            );
            return; // Skip this file
          }

          // Open document in LSP
          client.openDocument(fileUri, fileContent);

          // Wait a bit for LSP to process
          await new Promise((resolve) => setTimeout(resolve, 50)); // Reduced wait time

          // Try pull diagnostics first if available
          let diagnostics;
          if (client.pullDiagnostics) {
            try {
              diagnostics = await client.pullDiagnostics(fileUri);
            } catch {
              // Fall back to stored diagnostics
              diagnostics = client.getDiagnostics(fileUri);
            }
          } else {
            // Get stored diagnostics
            diagnostics = client.getDiagnostics(fileUri);
          }

          if (diagnostics && diagnostics.length > 0) {
            const mappedDiagnostics = diagnostics
              .filter((d: Diagnostic) => d && d.range) // Filter out invalid diagnostics
              .map((d: Diagnostic) => ({
                severity: SEVERITY_MAP[d.severity || 2] || "warning",
                line: d.range.start.line + 1, // Convert to 1-based
                column: d.range.start.character + 1, // Convert to 1-based
                endLine: d.range.end.line + 1,
                endColumn: d.range.end.character + 1,
                message: d.message,
                source: d.source,
                code: d.code,
              }))
              .filter((d: any) => {
                // Apply severity filter
                if (
                  request.severityFilter === "error" &&
                  d.severity !== "error"
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
              mappedDiagnostics.forEach((d: any) => {
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
    if (i + DIAGNOSTICS_BATCH_SIZE < files.length) {
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

/**
 * Create all diagnostics tool with injected LSP client
 */
export function createAllDiagnosticsTool(
  client: LSPClient,
): McpToolDef<typeof schema> {
  return {
    name: "get_all_diagnostics",
    description:
      "Get diagnostics (errors, warnings) for all files in the project. Requires a glob pattern to specify which files to check (e.g., '**/*.ts', '**/*.{js,jsx}', 'src/**/*.py')",
    schema,
    execute: async (args: z.infer<typeof schema>) => {
      const result = await getAllDiagnosticsWithLSP(args, client);

      const messages = [result.message];

      if (result.files.length > 0) {
        messages.push("");

        // If there are too many files with diagnostics, show a summary
        if (result.files.length > MAX_FILES_TO_SHOW) {
          messages.push(
            `Showing first ${MAX_FILES_TO_SHOW} files with diagnostics (${result.files.length} total):`,
          );
          messages.push("");
        }

        const filesToShow = result.files.slice(0, MAX_FILES_TO_SHOW);

        for (const file of filesToShow) {
          messages.push(`${file.filePath}:`);

          // Limit diagnostics per file to avoid extremely long output
          const diagsToShow = file.diagnostics.slice(
            0,
            MAX_DIAGNOSTICS_PER_FILE,
          );

          for (const diag of diagsToShow) {
            const prefix = diag.severity === "error" ? "  ❌" : "  ⚠️";
            messages.push(
              `${prefix} [${diag.severity}] Line ${diag.line}:${diag.column} - ${diag.message}`,
            );
          }

          if (file.diagnostics.length > MAX_DIAGNOSTICS_PER_FILE) {
            messages.push(
              `  ... and ${
                file.diagnostics.length - MAX_DIAGNOSTICS_PER_FILE
              } more diagnostics`,
            );
          }

          messages.push("");
        }

        if (result.files.length > MAX_FILES_TO_SHOW) {
          messages.push(
            `... and ${
              result.files.length - MAX_FILES_TO_SHOW
            } more files with diagnostics`,
          );
        }
      }

      return messages.join("\n");
    },
  };
}

// Legacy export - will be removed
export const lspGetAllDiagnosticsTool = null as any;
