import type {
  Diagnostic as LSPDiagnostic,
  Location,
} from "../../lsp/lspTypes.ts";
import { relative } from "path";

/**
 * Common diagnostic structure used across tools
 */
export interface Diagnostic {
  severity: "error" | "warning" | "info" | "hint";
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  source?: string;
}

/**
 * Builder for diagnostic results
 */
export class DiagnosticResultBuilder {
  private diagnostics: Diagnostic[] = [];
  private filePath?: string;
  // @ts-ignore - used in constructor
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
      severity: this.mapSeverity(diagnostic.severity || 1),
      line: diagnostic.range.start.line + 1,
      column: diagnostic.range.start.character + 1,
      endLine: diagnostic.range.end.line + 1,
      endColumn: diagnostic.range.end.character + 1,
      message: diagnostic.message,
      source: diagnostic.source,
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
  addDiagnostic(diagnostic: Diagnostic): this {
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
    diagnostics: Diagnostic[];
  } {
    const counts = this.getCounts();
    const parts: string[] = [];

    if (counts.errors > 0) parts.push(`${counts.errors} error(s)`);
    if (counts.warnings > 0) parts.push(`${counts.warnings} warning(s)`);
    if (counts.info > 0) parts.push(`${counts.info} info`);
    if (counts.hints > 0) parts.push(`${counts.hints} hint(s)`);

    let message: string;

    if (this.diagnostics.length === 0) {
      // When no diagnostics, show "0 errors and 0 warnings" format
      message = `Found 0 errors and 0 warnings`;
    } else if (parts.length > 0) {
      message = `Found ${parts.join(", ")}`;
    } else {
      message = "No diagnostics found";
    }

    if (this.filePath) {
      message += ` in ${this.filePath}`;
    }

    return {
      message,
      diagnostics: this.diagnostics,
    };
  }

  /**
   * Format as string for display
   */
  toString(): string {
    const result = this.build();
    const lines = [result.message];

    if (result.diagnostics.length > 0) {
      lines.push("");
      result.diagnostics.forEach((d) => {
        const location = `${this.filePath || ""}:${d.line}:${d.column}`;
        const severity = d.severity.toUpperCase();
        lines.push(`[${severity}] ${location} - ${d.message}`);
      });
    }

    return lines.join("\n");
  }

  private mapSeverity(severity: number): Diagnostic["severity"] {
    switch (severity) {
      case 1:
        return "error";
      case 2:
        return "warning";
      case 3:
        return "info";
      case 4:
        return "hint";
      default:
        return "info";
    }
  }
}

/**
 * Builder for reference results
 */
export class ReferenceResultBuilder {
  private references: Array<{
    file: string;
    line: number;
    column: number;
    text: string;
  }> = [];
  private symbolName?: string;
  private root?: string;

  constructor(root?: string, symbolName?: string) {
    this.root = root;
    this.symbolName = symbolName;
  }

  /**
   * Add an LSP location as reference
   */
  addLocation(location: Location, text: string): this {
    const filePath = location.uri.replace("file://", "");
    const relativePath = this.root ? relative(this.root, filePath) : filePath;

    this.references.push({
      file: relativePath,
      line: location.range.start.line + 1,
      column: location.range.start.character + 1,
      text: text.trim(),
    });
    return this;
  }

  /**
   * Add multiple locations
   */
  addLocations(locations: Array<{ location: Location; text: string }>): this {
    locations.forEach(({ location, text }) => this.addLocation(location, text));
    return this;
  }

  /**
   * Group references by file
   */
  groupByFile(): Map<string, typeof this.references> {
    const groups = new Map<string, typeof this.references>();

    this.references.forEach((ref) => {
      const existing = groups.get(ref.file) || [];
      existing.push(ref);
      groups.set(ref.file, existing);
    });

    return groups;
  }

  /**
   * Build the final result
   */
  build(): {
    message: string;
    // @ts-ignore - typeof this works at runtime
    references: typeof this.references;
    // @ts-ignore - typeof this works at runtime
    byFile: Map<string, typeof this.references>;
  } {
    const byFile = this.groupByFile();
    const fileCount = byFile.size;
    const refCount = this.references.length;

    let message = `Found ${refCount} reference(s)`;
    if (this.symbolName) {
      message += ` to "${this.symbolName}"`;
    }
    message += ` in ${fileCount} file(s)`;

    return {
      message,
      references: this.references,
      byFile,
    };
  }

  /**
   * Format as string for display
   */
  toString(): string {
    const result = this.build();
    const lines = [result.message];

    if (result.references.length > 0) {
      lines.push("");
      result.byFile.forEach((refs, file) => {
        lines.push(`\n📄 ${file}:`);
        // @ts-ignore - ref type is inferred correctly
        refs.forEach((ref) => {
          lines.push(`  ${ref.line}:${ref.column} - ${ref.text}`);
        });
      });
    }

    return lines.join("\n");
  }
}

/**
 * Builder for symbol results
 */
export class SymbolResultBuilder {
  private symbols: Array<{
    name: string;
    kind: string;
    location?: { line: number; column: number };
    containerName?: string;
  }> = [];
  private filePath?: string;

  constructor(filePath?: string) {
    this.filePath = filePath;
  }

  /**
   * Add a symbol
   */
  addSymbol(symbol: {
    name: string;
    kind: string | number;
    line?: number;
    column?: number;
    containerName?: string;
  }): this {
    this.symbols.push({
      name: symbol.name,
      kind:
        typeof symbol.kind === "string"
          ? symbol.kind
          : this.mapSymbolKind(symbol.kind),
      location:
        symbol.line !== undefined
          ? {
              line: symbol.line,
              column: symbol.column || 1,
            }
          : undefined,
      containerName: symbol.containerName,
    });
    return this;
  }

  /**
   * Group symbols by kind
   */
  groupByKind(): Map<string, typeof this.symbols> {
    const groups = new Map<string, typeof this.symbols>();

    this.symbols.forEach((symbol) => {
      const existing = groups.get(symbol.kind) || [];
      existing.push(symbol);
      groups.set(symbol.kind, existing);
    });

    return groups;
  }

  /**
   * Build the final result
   */
  build(): {
    message: string;
    // @ts-ignore - typeof this works at runtime
    symbols: typeof this.symbols;
    // @ts-ignore - typeof this works at runtime
    byKind: Map<string, typeof this.symbols>;
  } {
    const byKind = this.groupByKind();

    let message = `Found ${this.symbols.length} symbol(s)`;
    if (this.filePath) {
      message += ` in ${this.filePath}`;
    }

    return {
      message,
      symbols: this.symbols,
      byKind,
    };
  }

  /**
   * Format as string for display
   */
  toString(): string {
    const result = this.build();
    const lines = [result.message];

    if (result.symbols.length > 0) {
      lines.push("");
      result.byKind.forEach((symbols, kind) => {
        lines.push(`\n${kind}s:`);
        // @ts-ignore - s type is inferred correctly
        symbols.forEach((s) => {
          let line = `  ${s.name}`;
          if (s.containerName) {
            line += ` (in ${s.containerName})`;
          }
          if (s.location) {
            line += ` - ${s.location.line}:${s.location.column}`;
          }
          lines.push(line);
        });
      });
    }

    return lines.join("\n");
  }

  private mapSymbolKind(kind: number): string {
    // LSP SymbolKind enum
    const kinds: Record<number, string> = {
      1: "File",
      2: "Module",
      3: "Namespace",
      4: "Package",
      5: "Class",
      6: "Method",
      7: "Property",
      8: "Field",
      9: "Constructor",
      10: "Enum",
      11: "Interface",
      12: "Function",
      13: "Variable",
      14: "Constant",
      15: "String",
      16: "Number",
      17: "Boolean",
      18: "Array",
      19: "Object",
      20: "Key",
      21: "Null",
      22: "EnumMember",
      23: "Struct",
      24: "Event",
      25: "Operator",
      26: "TypeParameter",
    };
    return kinds[kind] || "Unknown";
  }
}
