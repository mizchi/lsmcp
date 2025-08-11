// Builder utilities for LSP types

import {
  Diagnostic as LSPDiagnostic,
  DiagnosticSeverity,
  Location,
  DocumentSymbol,
  SymbolInformation,
  SymbolKind,
  Range,
} from "vscode-languageserver-types";
import { relative } from "path";

/**
 * Simplified diagnostic structure for tool results
 */
export interface SimpleDiagnostic {
  severity: "error" | "warning" | "info" | "hint";
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  source?: string;
  code?: string | number;
}

/**
 * Builder for diagnostic results
 */
export class DiagnosticResultBuilder {
  private diagnostics: SimpleDiagnostic[] = [];
  private filePath?: string;
  private root?: string;

  constructor(root?: string, filePath?: string) {
    this.root = root;
    this.filePath = filePath;
  }

  /**
   * Add an LSP diagnostic
   */
  addLSPDiagnostic(diagnostic: LSPDiagnostic): this {
    this.diagnostics.push({
      severity: this.mapSeverity(
        diagnostic.severity || DiagnosticSeverity.Error,
      ),
      line: diagnostic.range.start.line + 1,
      column: diagnostic.range.start.character + 1,
      endLine: diagnostic.range.end.line + 1,
      endColumn: diagnostic.range.end.character + 1,
      message: diagnostic.message,
      source: diagnostic.source,
      code: diagnostic.code,
    });
    return this;
  }

  /**
   * Add multiple LSP diagnostics
   */
  addLSPDiagnostics(diagnostics: LSPDiagnostic[]): this {
    diagnostics.forEach((d) => this.addLSPDiagnostic(d));
    return this;
  }

  /**
   * Add a custom diagnostic
   */
  addDiagnostic(diagnostic: SimpleDiagnostic): this {
    this.diagnostics.push(diagnostic);
    return this;
  }

  /**
   * Get the count of diagnostics by severity
   */
  getCounts(): {
    errors: number;
    warnings: number;
    info: number;
    hints: number;
  } {
    const counts = { errors: 0, warnings: 0, info: 0, hints: 0 };
    this.diagnostics.forEach((d) => {
      switch (d.severity) {
        case "error":
          counts.errors++;
          break;
        case "warning":
          counts.warnings++;
          break;
        case "info":
          counts.info++;
          break;
        case "hint":
          counts.hints++;
          break;
      }
    });
    return counts;
  }

  /**
   * Build the final result
   */
  build(): {
    message: string;
    diagnostics: SimpleDiagnostic[];
  } {
    const counts = this.getCounts();
    const parts: string[] = [];

    if (counts.errors > 0) {
      parts.push(`${counts.errors} error${counts.errors !== 1 ? "s" : ""}`);
    }
    if (counts.warnings > 0) {
      parts.push(
        `${counts.warnings} warning${counts.warnings !== 1 ? "s" : ""}`,
      );
    }
    if (counts.info > 0) {
      parts.push(`${counts.info} info message${counts.info !== 1 ? "s" : ""}`);
    }
    if (counts.hints > 0) {
      parts.push(`${counts.hints} hint${counts.hints !== 1 ? "s" : ""}`);
    }

    let message = "";
    if (parts.length === 0) {
      message = this.filePath
        ? `No diagnostics found in ${this.filePath}`
        : "No diagnostics found";
    } else {
      const summary = parts.join(", ");
      if (this.filePath) {
        message = `Found ${summary} in ${this.filePath}`;
      } else {
        message = `Found ${summary}`;
      }
    }

    // Add diagnostic details
    if (this.diagnostics.length > 0) {
      message += "\n\n";
      message += this.diagnostics
        .map((d) => this.formatDiagnostic(d))
        .join("\n");
    }

    return { message, diagnostics: this.diagnostics };
  }

  /**
   * Format a single diagnostic
   */
  private formatDiagnostic(diagnostic: SimpleDiagnostic): string {
    const severity = diagnostic.severity.toUpperCase();
    const location = `${diagnostic.line}:${diagnostic.column}`;
    const source = diagnostic.source ? ` [${diagnostic.source}]` : "";
    const code = diagnostic.code ? ` (${diagnostic.code})` : "";
    return `[${severity}] ${location}: ${diagnostic.message}${source}${code}`;
  }

  /**
   * Map LSP severity to our severity
   */
  private mapSeverity(
    severity: DiagnosticSeverity,
  ): "error" | "warning" | "info" | "hint" {
    switch (severity) {
      case DiagnosticSeverity.Error:
        return "error";
      case DiagnosticSeverity.Warning:
        return "warning";
      case DiagnosticSeverity.Information:
        return "info";
      case DiagnosticSeverity.Hint:
        return "hint";
      default:
        return "info";
    }
  }
}

/**
 * Builder for location results
 */
export class LocationResultBuilder {
  private locations: Location[] = [];
  private root?: string;

  constructor(root?: string) {
    this.root = root;
  }

  addLocation(location: Location): this {
    this.locations.push(location);
    return this;
  }

  addLocations(locations: Location[]): this {
    this.locations.push(...locations);
    return this;
  }

  build(): { message: string; locations: Location[] } {
    if (this.locations.length === 0) {
      return { message: "No locations found", locations: [] };
    }

    const fileMap = new Map<string, Location[]>();
    for (const loc of this.locations) {
      const file = this.root ? relative(this.root, loc.uri) : loc.uri;
      if (!fileMap.has(file)) {
        fileMap.set(file, []);
      }
      fileMap.get(file)!.push(loc);
    }

    const message = `Found ${this.locations.length} location${
      this.locations.length !== 1 ? "s" : ""
    } in ${fileMap.size} file${fileMap.size !== 1 ? "s" : ""}`;

    return { message, locations: this.locations };
  }
}

/**
 * Builder for symbol results
 */
export class SymbolResultBuilder {
  private symbols: (DocumentSymbol | SymbolInformation)[] = [];
  private filePath?: string;

  constructor(filePath?: string) {
    this.filePath = filePath;
  }

  addSymbol(symbol: DocumentSymbol | SymbolInformation): this {
    this.symbols.push(symbol);
    return this;
  }

  addSymbols(symbols: (DocumentSymbol | SymbolInformation)[]): this {
    this.symbols.push(...symbols);
    return this;
  }

  build(): {
    message: string;
    symbols: (DocumentSymbol | SymbolInformation)[];
    stats: Record<string, number>;
  } {
    if (this.symbols.length === 0) {
      const message = this.filePath
        ? `No symbols found in ${this.filePath}`
        : "No symbols found";
      return { message, symbols: [], stats: {} };
    }

    // Count symbols by kind
    const stats: Record<string, number> = {};
    const countSymbols = (symbol: DocumentSymbol | SymbolInformation) => {
      const kindName = getSymbolKindName(symbol.kind);
      stats[kindName] = (stats[kindName] || 0) + 1;

      // Count children for DocumentSymbol
      if ("children" in symbol && symbol.children) {
        symbol.children.forEach(countSymbols);
      }
    };

    this.symbols.forEach(countSymbols);

    const summaryParts = Object.entries(stats)
      .map(([kind, count]) => `${count} ${kind}${count !== 1 ? "s" : ""}`)
      .join(", ");

    const message = this.filePath
      ? `Found ${this.symbols.length} symbols in ${this.filePath}: ${summaryParts}`
      : `Found ${this.symbols.length} symbols: ${summaryParts}`;

    return { message, symbols: this.symbols, stats };
  }
}

// Helper function to get symbol kind name
function getSymbolKindName(kind: SymbolKind): string {
  const names: Record<SymbolKind, string> = {
    [SymbolKind.File]: "File",
    [SymbolKind.Module]: "Module",
    [SymbolKind.Namespace]: "Namespace",
    [SymbolKind.Package]: "Package",
    [SymbolKind.Class]: "Class",
    [SymbolKind.Method]: "Method",
    [SymbolKind.Property]: "Property",
    [SymbolKind.Field]: "Field",
    [SymbolKind.Constructor]: "Constructor",
    [SymbolKind.Enum]: "Enum",
    [SymbolKind.Interface]: "Interface",
    [SymbolKind.Function]: "Function",
    [SymbolKind.Variable]: "Variable",
    [SymbolKind.Constant]: "Constant",
    [SymbolKind.String]: "String",
    [SymbolKind.Number]: "Number",
    [SymbolKind.Boolean]: "Boolean",
    [SymbolKind.Array]: "Array",
    [SymbolKind.Object]: "Object",
    [SymbolKind.Key]: "Key",
    [SymbolKind.Null]: "Null",
    [SymbolKind.EnumMember]: "EnumMember",
    [SymbolKind.Struct]: "Struct",
    [SymbolKind.Event]: "Event",
    [SymbolKind.Operator]: "Operator",
    [SymbolKind.TypeParameter]: "TypeParameter",
  };
  return names[kind] || "Unknown";
}
