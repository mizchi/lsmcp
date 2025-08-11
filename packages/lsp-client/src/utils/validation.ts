/**
 * Common validation utilities for LSP tools
 */

export function validateLineAndSymbol(
  content: string,
  line: number | string,
  symbolName: string,
  filePath: string,
) {
  const lines = content.split("\n");
  let lineIndex: number;

  if (typeof line === "number") {
    lineIndex = line - 1;
  } else {
    lineIndex = lines.findIndex((l) => l.includes(line));
    if (lineIndex === -1) {
      throw new Error(`Line containing "${line}" not found in ${filePath}`);
    }
  }

  const lineContent = lines[lineIndex];
  const symbolIndex = lineContent.indexOf(symbolName);

  if (symbolIndex === -1) {
    throw new Error(
      `Symbol "${symbolName}" not found on line ${lineIndex + 1} in ${filePath}`,
    );
  }

  return { lineIndex, symbolIndex };
}
