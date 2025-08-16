/**
 * Internal diagnostics functions for project overview and other tools
 * Not exposed as MCP tools
 */

import type { McpContext } from "@internal/types";
import type { LSPClient } from "@internal/lsp-client";
import { getAllDiagnostics } from "../lsp/allDiagnostics.ts";

export interface DiagnosticsOptions {
  root?: string;
  relativePath?: string;
  pattern?: string;
  severityFilter?: "error" | "warning" | "all";
}

/**
 * Internal function to get diagnostics - not exposed as MCP tool
 * Used by project overview and other internal tools
 */
export async function getProjectDiagnostics(
  args: DiagnosticsOptions,
  client: LSPClient,
  context?: McpContext,
): Promise<{ errorCount: number; warningCount: number; details?: string }> {
  const rootPath = args.root || process.cwd();
  const severityFilter = args.severityFilter || "all";

  // Pattern-based or all files diagnostics
  const pattern =
    args.pattern || determineDefaultPattern(context) || "**/*.{ts,tsx,js,jsx}";

  try {
    const result = await getAllDiagnostics(
      {
        root: rootPath,
        pattern,
        severityFilter,
        useGitignore: true,
      },
      client,
    );

    return {
      errorCount: result.totalErrors || 0,
      warningCount: result.totalWarnings || 0,
      details: result.message,
    };
  } catch (error) {
    return {
      errorCount: 0,
      warningCount: 0,
      details: `Failed to get diagnostics: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
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
