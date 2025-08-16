/**
 * High-level unified diagnostics tool that combines single file and pattern-based diagnostics
 */

import { z } from "zod";
import type { McpToolDef, McpContext } from "@internal/types";
import type { LSPClient } from "@internal/lsp-client";
import * as path from "path";
import { getDiagnosticsWithLSPV2 } from "../lsp/diagnostics.ts";
import { getAllDiagnostics } from "../lsp/allDiagnostics.ts";

const schema = z.object({
  root: z.string().describe("Root directory for the project").optional(),
  relativePath: z
    .string()
    .describe("Specific file to check (takes precedence over pattern)")
    .optional(),
  pattern: z
    .string()
    .describe(
      "Glob pattern for files to check (e.g., '**/*.ts', 'src/**/*.py')",
    )
    .optional(),
  severityFilter: z
    .enum(["error", "warning", "all"])
    .default("all")
    .describe("Filter diagnostics by severity"),
});

/**
 * Create unified diagnostics tool with injected LSP client
 */
export function createGetDiagnosticsTool(
  client: LSPClient,
): McpToolDef<typeof schema> {
  return {
    name: "get_diagnostics",
    description:
      "Get diagnostics (errors, warnings) for your code. " +
      "Without arguments: checks all project files. " +
      "With relativePath: checks a specific file. " +
      "With pattern: checks files matching the pattern. " +
      "This tool will guide you to use specific LSP tools for detailed analysis.",
    schema,
    execute: async (args, context?: McpContext) => {
      const rootPath = args.root || process.cwd();

      // Single file diagnostics
      if (args.relativePath) {
        try {
          const result = await getDiagnosticsWithLSPV2(
            {
              root: rootPath,
              relativePath: args.relativePath,
              timeout: 5000,
              forceRefresh: true,
            },
            client,
          );

          if (result.isErr()) {
            return `Error getting diagnostics: ${result.error}`;
          }

          const { diagnostics, debug } = result.value;

          let output = `Diagnostics for ${args.relativePath}:\n`;
          output += `(Method: ${debug.method}, Time: ${debug.totalTime}ms)\n\n`;

          if (diagnostics.length === 0) {
            output += "✓ No issues found!\n";
          } else {
            // Group by severity
            const errors = diagnostics.filter((d) => d.severity === "error");
            const warnings = diagnostics.filter(
              (d) => d.severity === "warning",
            );
            const others = diagnostics.filter(
              (d) => d.severity !== "error" && d.severity !== "warning",
            );

            if (
              errors.length > 0 &&
              (args.severityFilter === "error" || args.severityFilter === "all")
            ) {
              output += `❌ ${errors.length} Error(s):\n`;
              for (const diag of errors) {
                output += `   Line ${diag.line}:${diag.column}: ${diag.message}\n`;
                if (diag.source) {
                  output += `   Source: ${diag.source}\n`;
                }
              }
              output += `\n`;
            }

            if (
              warnings.length > 0 &&
              (args.severityFilter === "warning" ||
                args.severityFilter === "all")
            ) {
              output += `⚠️  ${warnings.length} Warning(s):\n`;
              for (const diag of warnings) {
                output += `   Line ${diag.line}:${diag.column}: ${diag.message}\n`;
                if (diag.source) {
                  output += `   Source: ${diag.source}\n`;
                }
              }
              output += `\n`;
            }

            if (others.length > 0 && args.severityFilter === "all") {
              output += `ℹ️  ${others.length} Other issue(s):\n`;
              for (const diag of others) {
                output += `   [${diag.severity}] Line ${diag.line}:${diag.column}: ${diag.message}\n`;
              }
              output += `\n`;
            }

            // Add LSP tool guidance
            output += `For more detailed analysis, use:\n`;
            output += `• lsp_get_diagnostics --root "${rootPath}" --relativePath "${args.relativePath}"\n`;
          }

          return output;
        } catch (error) {
          return `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      // Pattern-based or all files diagnostics
      const pattern = args.pattern || determineDefaultPattern(context);

      if (!pattern) {
        return "Please specify either a file path, a pattern, or configure a preset/files in your config.";
      }

      try {
        const result = await getAllDiagnostics(
          {
            root: rootPath,
            pattern,
            severityFilter: args.severityFilter,
            useGitignore: true,
          },
          client,
        );

        let output = `Diagnostics for pattern "${pattern}":\n\n`;

        const filesChecked = result.files?.length || 0;
        if (filesChecked === 0) {
          output += "No files found matching the pattern.\n";
          return output;
        }

        output += `Checked ${filesChecked} file(s)\n`;

        if (result.totalErrors === 0 && result.totalWarnings === 0) {
          output += "✓ No issues found in any files!\n";
        } else {
          output += `Found: ${result.totalErrors} error(s), ${result.totalWarnings} warning(s)\n\n`;

          // Show files with issues
          let filesShown = 0;
          const maxFilesToShow = 10;

          for (const file of result.files) {
            if (file.diagnostics.length === 0) continue;
            if (filesShown >= maxFilesToShow) {
              const remainingFiles =
                result.files.filter((f) => f.diagnostics.length > 0).length -
                filesShown;
              if (remainingFiles > 0) {
                output += `\n... and ${remainingFiles} more file(s) with issues.\n`;
              }
              break;
            }

            const relativePath = path.relative(rootPath, file.filePath);
            const fileErrors = file.diagnostics.filter(
              (d) => d.severity === "error",
            ).length;
            const fileWarnings = file.diagnostics.filter(
              (d) => d.severity === "warning",
            ).length;

            output += `📄 ${relativePath}: ${fileErrors} error(s), ${fileWarnings} warning(s)\n`;

            // Show first few diagnostics for this file
            const maxDiagsPerFile = 3;
            for (
              let i = 0;
              i < Math.min(file.diagnostics.length, maxDiagsPerFile);
              i++
            ) {
              const diag = file.diagnostics[i];
              const severity =
                diag.severity === "error"
                  ? "ERROR"
                  : diag.severity === "warning"
                    ? "WARN"
                    : "INFO";
              output += `   [${severity}] Line ${diag.line}: ${diag.message}\n`;
            }

            if (file.diagnostics.length > maxDiagsPerFile) {
              output += `   ... and ${file.diagnostics.length - maxDiagsPerFile} more issue(s)\n`;
            }

            // Add LSP tool guidance for this file
            output += `   → Details: lsp_get_diagnostics --root "${rootPath}" --relativePath "${relativePath}"\n`;
            output += `\n`;

            filesShown++;
          }
        }

        // Add general LSP tool guidance
        output += `\nFor comprehensive diagnostics across all files, use:\n`;
        output += `• lsp_get_all_diagnostics --root "${rootPath}" --pattern "${pattern}"\n`;

        return output;
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };
}

/**
 * Determine default pattern based on context
 */
function determineDefaultPattern(context?: McpContext): string | null {
  // Try to get pattern from context
  if (context?.config?.files && Array.isArray(context.config.files)) {
    return context.config.files.join(",");
  }

  if (context?.config?.preset) {
    // Map preset to common patterns
    const presetPatterns: Record<string, string> = {
      typescript: "**/*.{ts,tsx}",
      tsgo: "**/*.{ts,tsx}",
      javascript: "**/*.{js,jsx}",
      python: "**/*.py",
      pyright: "**/*.py",
      rust: "**/*.rs",
      go: "**/*.go",
    };

    const preset = context.config.preset as string;
    return presetPatterns[preset.toLowerCase()] || null;
  }

  return null;
}
