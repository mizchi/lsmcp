import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver-types";

// Diagnostic-related types

// Pull diagnostics support (LSP 3.17+)
export interface DocumentDiagnosticReport {
  kind: "full" | "unchanged";
  items?: Diagnostic[];
  resultId?: string;
}

export interface DiagnosticResult {
  uri: string;
  diagnostics: Diagnostic[];
}

export interface DiagnosticStats {
  total: number;
  errors: number;
  warnings: number;
  informations: number;
  hints: number;
}

export interface DiagnosticFilter {
  severity?: DiagnosticSeverity | DiagnosticSeverity[];
  source?: string;
  code?: string | number;
  message?: string | RegExp;
}

export interface FormattedDiagnostic {
  severity: "error" | "warning" | "info" | "hint";
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  source?: string;
  code?: string | number;
}

// Diagnostic support capabilities
export interface DiagnosticSupport {
  pushDiagnostics: boolean;
  pullDiagnostics: boolean;
  relatedInformation?: boolean;
  tags?: boolean;
  codeDescription?: boolean;
  data?: boolean;
}

// Constants
export const DIAGNOSTIC_SEVERITY_NAMES = {
  [DiagnosticSeverity.Error]: "error",
  [DiagnosticSeverity.Warning]: "warning",
  [DiagnosticSeverity.Information]: "info",
  [DiagnosticSeverity.Hint]: "hint",
} as const;

export function getSeverityName(severity: DiagnosticSeverity): string {
  return DIAGNOSTIC_SEVERITY_NAMES[severity] || "unknown";
}

export function parseSeverity(value: string): DiagnosticSeverity | undefined {
  const normalized = value.toLowerCase();
  for (const [severity, name] of Object.entries(DIAGNOSTIC_SEVERITY_NAMES)) {
    if (name === normalized) {
      return Number(severity) as DiagnosticSeverity;
    }
  }
  return undefined;
}
