import { readFileWithMetadata } from "./fileOperations.ts";
import { validateLine, validateLineAndSymbol } from "../pure/validation.ts";
import { findTargetInFile } from "../../core/textUtils/findTargetInFile.ts";
import { errors } from "../pure/errors/index.ts";

/**
 * Base result for file resolution
 */
export interface FileResolutionResult {
  /** Absolute path to the file */
  absolutePath: string;

  /** File content */
  fileContent: string;

  /** File URI for LSP */
  fileUri: string;

  /** Lines array for convenience */
  lines: string[];
}

/**
 * Result when line is resolved
 */
export interface FileLineResolutionResult extends FileResolutionResult {
  /** Line index (0-based) */
  lineIndex: number;

  /** Line content */
  lineContent: string;
}

/**
 * Result when both line and symbol are resolved
 */
export interface FileSymbolResolutionResult extends FileLineResolutionResult {
  /** Character index of symbol in line (0-based) */
  symbolIndex: number;
}

/**
 * Options for resolving file and symbol
 */
export interface ResolveFileAndSymbolOptions {
  /** Root directory */
  root: string;

  /** File path relative to root */
  filePath: string;

  /** Line number (1-based) or string to search */
  line?: string | number;

  /** Symbol name to find in the line */
  symbolName?: string;

  /** Target text to find (when line is not provided) */
  target?: string;
}

/**
 * Resolves file content and optionally line/symbol positions
 *
 * @example
 * ```typescript
 * // Just file
 * const file = await resolveFileAndSymbol({ root, filePath });
 *
 * // File and line
 * const fileLine = await resolveFileAndSymbol({ root, filePath, line: 10 });
 *
 * // File, line and symbol
 * const fileSymbol = await resolveFileAndSymbol({
 *   root, filePath, line: 10, symbolName: "myFunction"
 * });
 *
 * // Find target without line
 * const found = await resolveFileAndSymbol({
 *   root, filePath, target: "myFunction"
 * });
 * ```
 */
export function resolveFileAndSymbol(
  options: ResolveFileAndSymbolOptions & {
    line: string | number;
    symbolName: string;
  },
): FileSymbolResolutionResult;
export function resolveFileAndSymbol(
  options: ResolveFileAndSymbolOptions & { line: string | number },
): FileLineResolutionResult;
export function resolveFileAndSymbol(
  options: ResolveFileAndSymbolOptions & { target: string },
): FileSymbolResolutionResult;
export function resolveFileAndSymbol(
  options: ResolveFileAndSymbolOptions,
): FileResolutionResult;
export function resolveFileAndSymbol(
  options: ResolveFileAndSymbolOptions,
):
  | FileResolutionResult
  | FileLineResolutionResult
  | FileSymbolResolutionResult {
  const { root, filePath, line, symbolName, target } = options;

  // Read file with metadata
  const { absolutePath, fileContent, fileUri } = readFileWithMetadata(
    root,
    filePath,
  );
  const lines = fileContent.split("\n");

  // Just file resolution
  if (line === undefined && !target) {
    return { absolutePath, fileContent, fileUri, lines };
  }

  // Target search without line
  if (target && line === undefined) {
    const targetResult = findTargetInFile(lines, target);
    if ("error" in targetResult) {
      throw errors.symbolNotFound(target, undefined, {
        filePath,
        operation: "find_target",
      });
    }

    return {
      absolutePath,
      fileContent,
      fileUri,
      lines,
      lineIndex: targetResult.lineIndex,
      lineContent: lines[targetResult.lineIndex],
      symbolIndex: targetResult.characterIndex,
    };
  }

  // Line and symbol resolution
  if (line !== undefined && symbolName) {
    const { lineIndex, lineContent, symbolIndex } = validateLineAndSymbol(
      fileContent,
      line,
      symbolName,
      filePath,
    );

    return {
      absolutePath,
      fileContent,
      fileUri,
      lines,
      lineIndex,
      lineContent,
      symbolIndex,
    };
  }

  // Just line resolution
  if (line !== undefined) {
    const { lineIndex, lineContent } = validateLine(
      fileContent,
      line,
      filePath,
    );

    return {
      absolutePath,
      fileContent,
      fileUri,
      lines,
      lineIndex,
      lineContent,
    };
  }

  // Should never reach here due to overloads
  return { absolutePath, fileContent, fileUri, lines };
}

/**
 * Helper type guards
 */
export function hasLineResolution(
  result: FileResolutionResult,
): result is FileLineResolutionResult {
  return "lineIndex" in result && "lineContent" in result;
}

export function hasSymbolResolution(
  result: FileResolutionResult,
): result is FileSymbolResolutionResult {
  return hasLineResolution(result) && "symbolIndex" in result;
}
