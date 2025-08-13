import { parseLineNumber } from "./parseLineNumber.ts";
import { findSymbolInLine } from "./findSymbolInLine.ts";
import { errors } from "../../../domain/errors/index.ts";

interface LineAndSymbolResult {
  lineIndex: number;
  lineContent: string;
  symbolIndex: number;
}

/**
 * Validate and find line and symbol position in file content
 * @param fileContent The file content
 * @param line Line number (1-based) or string to match
 * @param symbolName Symbol name to find
 * @param filePath File path for error messages
 * @returns LineAndSymbolResult with line index, content, and symbol index
 * @throws LSMCPError if validation fails
 */
export function validateLineAndSymbol(
  fileContent: string,
  line: string | number,
  symbolName: string,
  filePath: string,
): LineAndSymbolResult {
  // Parse line number
  const lineResult = parseLineNumber(fileContent, line);
  if ("error" in lineResult) {
    throw errors.lineNotFound(line, filePath);
  }

  const { targetLine, lineText } = lineResult;

  // Find symbol in line
  const symbolResult = findSymbolInLine(lineText, symbolName);
  if ("error" in symbolResult) {
    throw errors.symbolNotFound(symbolName, targetLine + 1);
  }

  return {
    lineIndex: targetLine,
    lineContent: lineText,
    symbolIndex: symbolResult.characterIndex,
  };
}

/**
 * Validate line number only
 * @param fileContent The file content
 * @param line Line number (1-based) or string to match
 * @param filePath File path for error messages
 * @returns Line index and content
 * @throws LSMCPError if validation fails
 */
export function validateLine(
  fileContent: string,
  line: string | number,
  filePath: string,
): { lineIndex: number; lineContent: string } {
  const lineResult = parseLineNumber(fileContent, line);
  if ("error" in lineResult) {
    throw errors.lineNotFound(line, filePath);
  }

  return {
    lineIndex: lineResult.targetLine,
    lineContent: lineResult.lineText,
  };
}
