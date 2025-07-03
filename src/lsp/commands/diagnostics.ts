import type { Diagnostic } from "vscode-languageserver-types";
import type { LSPCommand } from "./types.ts";

// Pull diagnostics support (LSP 3.17+)
interface DocumentDiagnosticReport {
  kind: "full" | "unchanged";
  items?: Diagnostic[];
  resultId?: string;
}

interface DocumentDiagnosticParams {
  uri: string;
  previousResultId?: string;
}

export function createPullDiagnosticsCommand(): LSPCommand<
  DocumentDiagnosticParams,
  Diagnostic[]
> {
  return {
    method: "textDocument/diagnostic",

    buildParams(input: DocumentDiagnosticParams) {
      return {
        textDocument: { uri: input.uri },
        previousResultId: input.previousResultId,
      };
    },

    processResponse(response: unknown): Diagnostic[] {
      if (!response) {
        return [];
      }

      const report = response as DocumentDiagnosticReport;

      if (report.kind === "full" && report.items) {
        return report.items;
      }

      return [];
    },
  };
}

// In-source tests using Vitest
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("PullDiagnosticsCommand", () => {
    const command = createPullDiagnosticsCommand();

    describe("buildParams", () => {
      it("should build correct parameters without previousResultId", () => {
        const params = command.buildParams({
          uri: "file:///test.ts",
        });

        expect(params).toEqual({
          textDocument: { uri: "file:///test.ts" },
          previousResultId: undefined,
        });
      });

      it("should build correct parameters with previousResultId", () => {
        const params = command.buildParams({
          uri: "file:///test.ts",
          previousResultId: "result-123",
        });

        expect(params).toEqual({
          textDocument: { uri: "file:///test.ts" },
          previousResultId: "result-123",
        });
      });
    });

    describe("processResponse", () => {
      it("should handle null response", () => {
        const result = command.processResponse(null);
        expect(result).toEqual([]);
      });

      it("should handle undefined response", () => {
        const result = command.processResponse(undefined);
        expect(result).toEqual([]);
      });

      it("should handle full report with diagnostics", () => {
        const diagnostics: Diagnostic[] = [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 10 },
            },
            severity: 1, // Error
            message: "Syntax error",
          },
          {
            range: {
              start: { line: 5, character: 0 },
              end: { line: 5, character: 5 },
            },
            severity: 2, // Warning
            message: "Unused variable",
          },
        ];

        const report: DocumentDiagnosticReport = {
          kind: "full",
          items: diagnostics,
          resultId: "result-123",
        };

        const result = command.processResponse(report);
        expect(result).toEqual(diagnostics);
      });

      it("should handle full report without items", () => {
        const report: DocumentDiagnosticReport = {
          kind: "full",
        };

        const result = command.processResponse(report);
        expect(result).toEqual([]);
      });

      it("should handle unchanged report", () => {
        const report: DocumentDiagnosticReport = {
          kind: "unchanged",
          resultId: "result-123",
        };

        const result = command.processResponse(report);
        expect(result).toEqual([]);
      });
    });
  });
}
