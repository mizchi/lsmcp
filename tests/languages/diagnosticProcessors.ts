import type { Diagnostic } from "vscode-languageserver-protocol";

interface ProcessedDiagnostic {
  file: string;
  severity: number;
  message: string;
  line: number;
  source?: string;
}

/**
 * Process diagnostics with deduplication and validation
 * Some LSP servers may have issues:
 * 1. Reports duplicate diagnostics
 * 2. Reports diagnostics for non-existent lines
 * 3. May report diagnostics multiple times with different line numbers
 */
export function processDeduplicatedDiagnostics(
  diagnostics: Diagnostic[],
  filePath: string,
  fileContent: string,
): ProcessedDiagnostic[] {
  const lineCount = fileContent.split("\n").length;
  const processed: ProcessedDiagnostic[] = [];
  const seen = new Set<string>();

  for (const diagnostic of diagnostics) {
    const line = diagnostic.range.start.line;

    // Skip diagnostics for lines that don't exist
    if (line >= lineCount) {
      continue;
    }

    // Create a unique key for deduplication
    const key = `${line}:${diagnostic.message}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    processed.push({
      file: filePath,
      severity: diagnostic.severity || 1,
      message: diagnostic.message,
      line: line,
      source: diagnostic.source,
    });
  }

  return processed;
}
/**
 * Default diagnostic processor
 */
export function processDefaultDiagnostics(
  diagnostics: Diagnostic[],
  filePath: string,
  _fileContent: string,
): ProcessedDiagnostic[] {
  return diagnostics.map((d) => ({
    file: filePath,
    severity: d.severity || 1,
    message: d.message.substring(0, 80) + (d.message.length > 80 ? "..." : ""),
    line: d.range.start.line,
    source: d.source,
  }));
}
