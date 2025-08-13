import { readFileWithUri } from "../../infrastructure/fileOperations.ts";

/**
 * Common function to resolve file and symbol position for LSP operations
 */
export function resolveFileAndSymbol(params: {
  root: string;
  filePath: string;
  line?: number | string;
  symbolName?: string;
  target?: string;
}) {
  const {
    content: fileContent,
    uri: fileUri,
    absolutePath,
  } = readFileWithUri(params.root, params.filePath);
  const lines = fileContent.split("\n");

  let lineIndex = 0;
  let symbolIndex = 0;

  if (params.line !== undefined) {
    if (typeof params.line === "number") {
      lineIndex = params.line - 1;
    } else {
      lineIndex = lines.findIndex((l) => l.includes(params.line as string));
      if (lineIndex === -1) {
        throw new Error(
          `Line containing "${params.line}" not found in ${params.filePath}`,
        );
      }
    }
  }

  if (params.symbolName) {
    const lineContent = lines[lineIndex];
    symbolIndex = lineContent.indexOf(params.symbolName);
    if (symbolIndex === -1) {
      throw new Error(
        `Symbol "${params.symbolName}" not found on line ${lineIndex + 1} in ${params.filePath}`,
      );
    }
  } else if (params.target) {
    // If no line specified, search for target in entire file
    if (params.line === undefined) {
      for (let i = 0; i < lines.length; i++) {
        const idx = lines[i].indexOf(params.target);
        if (idx !== -1) {
          lineIndex = i;
          symbolIndex = idx;
          break;
        }
      }
      if (symbolIndex === -1) {
        throw new Error(
          `Target "${params.target}" not found in ${params.filePath}`,
        );
      }
    } else {
      // Search for target on specified line
      const lineContent = lines[lineIndex];
      symbolIndex = lineContent.indexOf(params.target);
      if (symbolIndex === -1) {
        throw new Error(
          `Target "${params.target}" not found on line ${lineIndex + 1} in ${params.filePath}`,
        );
      }
    }
  }

  return {
    fileUri,
    fileContent,
    absolutePath,
    lines,
    lineIndex,
    symbolIndex,
  };
}

/**
 * Helper to read file with metadata (simplified version)
 */
export function readFileWithMetadata(root: string, filePath: string) {
  const {
    content: fileContent,
    uri: fileUri,
    absolutePath,
  } = readFileWithUri(root, filePath);
  return { fileContent, fileUri, absolutePath };
}
