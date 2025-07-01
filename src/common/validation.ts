import { parseLineNumber } from "../textUtils/parseLineNumber.ts";
import { findSymbolInLine } from "../textUtils/findSymbolInLine.ts";
import { MCPToolError } from "./mcpErrors.ts";

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
 * @throws MCPToolError if validation fails
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
    throw new MCPToolError(
      `${lineResult.error} in ${filePath}`,
      "LINE_NOT_FOUND",
    );
  }

  const { targetLine, lineText } = lineResult;

  // Find symbol in line
  const symbolResult = findSymbolInLine(lineText, symbolName);
  if ("error" in symbolResult) {
    throw new MCPToolError(
      `${symbolResult.error} on line ${targetLine + 1}`,
      "SYMBOL_NOT_FOUND",
    );
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
 * @throws MCPToolError if validation fails
 */
export function validateLine(
  fileContent: string,
  line: string | number,
  filePath: string,
): { lineIndex: number; lineContent: string } {
  const lineResult = parseLineNumber(fileContent, line);
  if ("error" in lineResult) {
    throw new MCPToolError(
      `${lineResult.error} in ${filePath}`,
      "LINE_NOT_FOUND",
    );
  }

  return {
    lineIndex: lineResult.targetLine,
    lineContent: lineResult.lineText,
  };
}

/**
 * Find symbol position without specific line
 * @param fileContent The file content
 * @param symbolName Symbol name to find
 * @returns Line index and symbol index
 * @throws MCPToolError if symbol not found
 */
function findSymbolPosition(
  fileContent: string,
  symbolName: string,
): { lineIndex: number; symbolIndex: number } {
  const lines = fileContent.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const symbolResult = findSymbolInLine(lines[lineIndex], symbolName);
    if (!("error" in symbolResult)) {
      return { lineIndex, symbolIndex: symbolResult.characterIndex };
    }
  }

  throw new MCPToolError(
    `Symbol "${symbolName}" not found in file`,
    "SYMBOL_NOT_FOUND",
  );
}
