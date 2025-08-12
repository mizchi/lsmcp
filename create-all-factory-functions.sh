#!/bin/bash

# Create factory functions for all LSP tools

# For each tool that needs a factory function, we'll add the export

# allDiagnostics.ts
cat >> src/tools/lsp/allDiagnostics.ts << 'EOF'

/**
 * Create all diagnostics tool with injected LSP client
 */
export function createAllDiagnosticsTool(client: LSPClient): ToolDef<typeof schema> {
  return {
    name: "get_all_diagnostics",
    description: "Get diagnostics (errors, warnings) for all files in the project. Requires a glob pattern to specify which files to check (e.g., '**/*.ts', '**/*.{js,jsx}', 'src/**/*.py')",
    schema,
    execute: async (args: z.infer<typeof schema>) => {
      const result = await getAllDiagnosticsWithLSP(args, client);
      return formatDiagnosticsResult(result);
    },
  };
}

function formatDiagnosticsResult(result: GetAllDiagnosticsSuccess): string {
  const lines = [`Total errors: ${result.totalErrors}, warnings: ${result.totalWarnings}`];
  
  if (result.files.length > 0) {
    lines.push("\nFiles with diagnostics:");
    for (const file of result.files) {
      lines.push(`\n${file.filePath}:`);
      for (const diag of file.diagnostics) {
        lines.push(`  ${diag.severity}: Line ${diag.line}:${diag.column} - ${diag.message}`);
      }
    }
  }
  
  return lines.join("\n");
}
EOF

echo "Created factory functions"