import type { Diagnostic } from "vscode-languageserver-protocol";
import { execSync } from "child_process";
import { unlinkSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export interface ProcessedDiagnostic {
  file: string;
  severity: number;
  message: string;
  line: number;
  source?: string;
}

/**
 * Process diagnostics for tsgo adapter
 * tsgo has known issues:
 * 1. Reports duplicate diagnostics
 * 2. Reports diagnostics for non-existent lines
 * 3. May report diagnostics multiple times with different line numbers
 */
export function processTsgoDiagnostics(
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
 * Process diagnostics for MoonBit adapter
 * Uses moonc compiler for syntax checking when LSP diagnostics are insufficient
 */
export function processMoonbitDiagnostics(
  diagnostics: Diagnostic[],
  filePath: string,
  fileContent: string,
  projectRoot?: string,
): ProcessedDiagnostic[] {
  const processed: ProcessedDiagnostic[] = [];

  // First, process LSP diagnostics
  for (const diagnostic of diagnostics) {
    processed.push({
      file: filePath,
      severity: diagnostic.severity || 1,
      message: diagnostic.message,
      line: diagnostic.range.start.line,
      source: diagnostic.source || "moonbit-lsp",
    });
  }

  // If no diagnostics from LSP, try moonc compiler check
  if (processed.length === 0) {
    try {
      const mooncDiagnostics = checkWithMoonc(
        filePath,
        fileContent,
        projectRoot,
      );
      processed.push(...mooncDiagnostics);
    } catch (error) {
      // If moonc check fails, add a fallback diagnostic
      processed.push({
        file: filePath,
        severity: 1, // Error
        message: `Failed to check syntax: ${
          error instanceof Error ? error.message : String(error)
        }`,
        line: 0,
        source: "moonc",
      });
    }
  }

  return processed;
}

function checkWithMoonc(
  filePath: string,
  fileContent: string,
  projectRoot?: string,
): ProcessedDiagnostic[] {
  let tempFile: string | null = null;

  try {
    // Create temporary file with content
    tempFile = join(tmpdir(), `moonbit-check-${Date.now()}.mbt`);
    writeFileSync(tempFile, fileContent);

    // Run moonc check
    try {
      execSync(`moonc check "${tempFile}"`, {
        stdio: "pipe",
        cwd: projectRoot,
        encoding: "utf-8",
      });

      // No errors
      return [];
    } catch (error: any) {
      const output = error.stderr || error.stdout || "";
      return parseMoonBitCompilerOutput(output, filePath);
    }
  } finally {
    // Clean up temporary file
    if (tempFile) {
      try {
        unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

function parseMoonBitCompilerOutput(
  output: string,
  filePath: string,
): ProcessedDiagnostic[] {
  const diagnostics: ProcessedDiagnostic[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    // Parse format: file.mbt:1:4-1:9 [E0001] Message
    const match = line.match(
      /^[^:]+:(\d+):(\d+)-(\d+):(\d+)\s+\[([A-Z]\d+)\]\s+(.+)$/,
    );
    if (match) {
      const [, startLine, , , , code, message] = match;

      // Determine severity
      const severity = message.toLowerCase().includes("warning") ? 2 : 1; // 1=Error, 2=Warning

      diagnostics.push({
        file: filePath,
        severity,
        message: `[${code}] ${message.trim()}`,
        line: parseInt(startLine) - 1, // Convert to 0-based
        source: "moonc",
      });
    }
  }

  return diagnostics;
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
