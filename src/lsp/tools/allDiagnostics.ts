import { z } from "zod";
import { promisify } from "util";
import { readFile } from "fs/promises";
import { join } from "path";
import { minimatch } from "minimatch";
import type { ToolDef } from "../../mcp/utils/mcpHelpers.ts";
import { getActiveClient } from "../lspClient.ts";
import { debug } from "../../mcp/utils/mcpHelpers.ts";
import { pathToFileURL } from "url";
import { Diagnostic } from "vscode-languageserver-types";
import { exec } from "child_process";
import { createGitignoreFilter } from "../../core/io/gitignoreUtils.ts";

const execAsync = promisify(exec);

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
 * Get all project files using combination of git ls-files and glob
 * This respects .gitignore while also including untracked files
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
  const fileSet = new Set<string>();

  // First, try to get tracked files from git
  try {
    const { stdout } = await execAsync("git ls-files", { cwd: root });
    const gitFiles = stdout
      .split("\n")
      .filter((f: string) => f.trim().length > 0)
      .filter((f: string) => minimatch(f, pattern));

    gitFiles.forEach((f) => fileSet.add(f));
    debug(
      `[lspGetAllDiagnostics] Found ${gitFiles.length} tracked files from git`,
    );
  } catch (error) {
    debug("Not a git repository or git ls-files failed:", error);
  }

  // Then, use glob to find all files (including untracked ones)
  try {
    const { glob } = await import("glob");

    // Basic ignore patterns that always apply
    let ignorePatterns: string[] = ["**/node_modules/**", "**/.git/**"];

    if (exclude) {
      ignorePatterns.push(exclude);
    }

    const globFiles = await glob(pattern, {
      cwd: root,
      ignore: ignorePatterns,
      nodir: true,
    });

    globFiles.forEach((f) => fileSet.add(f));
    debug(`[lspGetAllDiagnostics] Found ${globFiles.length} files from glob`);
  } catch (globError) {
    debug("Failed to use glob:", globError);
    // If glob fails but we have git files, continue with those
    if (fileSet.size === 0) {
      throw new Error(
        `Failed to list project files: ${
          globError instanceof Error ? globError.message : String(globError)
        }`,
      );
    }
  }

  // Convert set to array and apply filters
  let files = Array.from(fileSet);

  debug(`[lspGetAllDiagnostics] Files before filtering: ${files.length}`);
  debug(`[lspGetAllDiagnostics] Sample files: ${files.slice(0, 5).join(", ")}`);

  // Include pattern is already applied in git files and glob,
  // but we apply it again to the combined results for consistency
  debug(`[lspGetAllDiagnostics] Applying include pattern: ${pattern}`);
  files = files.filter((f: string) => minimatch(f, pattern));

  // Apply gitignore filtering if enabled
  if (useGitignore) {
    const gitignoreFilter = createGitignoreFilter(root);
    const originalCount = files.length;
    files = files.filter(gitignoreFilter);
    debug(
      `[lspGetAllDiagnostics] Gitignore filtered out ${
        originalCount - files.length
      } files`,
    );
  }

  // Apply exclude pattern if provided
  if (exclude) {
    files = files.filter((f: string) => !minimatch(f, exclude));
  }

  // Final filter to exclude common directories (redundant but safe)
  files = files.filter(
    (f: string) =>
      !f.includes("node_modules/") &&
      !f.includes(".git/") &&
      !f.includes("/obj/") && // Exclude build artifacts
      !f.includes("/bin/"), // Exclude build outputs
  );

  debug(`[lspGetAllDiagnostics] Total unique files to check: ${files.length}`);
  if (files.length > 0) {
    debug(
      `[lspGetAllDiagnostics] File extensions found: ${[
        ...new Set(
          files.map((f) => {
            const ext = f.lastIndexOf(".");
            return ext > 0 ? f.substring(ext) : "no-ext";
          }),
        ),
      ].join(", ")}`,
    );
  }
  return files;
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
  const BATCH_SIZE = 5; // Reduced batch size for stability
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);

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
  name: "get_all_diagnostics",
  description:
    "Get diagnostics (errors, warnings) for all files in the project. Requires a glob pattern to specify which files to check (e.g., '**/*.ts', '**/*.{js,jsx}', 'src/**/*.py')",
  schema,
  execute: async (args: z.infer<typeof schema>) => {
    const result = await getAllDiagnosticsWithLSP(args);

    const messages = [result.message];

    if (result.files.length > 0) {
      messages.push("");

      // If there are too many files with diagnostics, show a summary
      const MAX_FILES_TO_SHOW = 20;
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
        const MAX_DIAGS_PER_FILE = 10;
        const diagsToShow = file.diagnostics.slice(0, MAX_DIAGS_PER_FILE);

        for (const diag of diagsToShow) {
          const prefix = diag.severity === "error" ? "  ❌" : "  ⚠️";
          messages.push(
            `${prefix} [${diag.severity}] Line ${diag.line}:${diag.column} - ${diag.message}`,
          );
        }

        if (file.diagnostics.length > MAX_DIAGS_PER_FILE) {
          messages.push(
            `  ... and ${
              file.diagnostics.length - MAX_DIAGS_PER_FILE
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
