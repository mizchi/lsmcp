import { resolve } from "path";
import { pathToFileURL } from "url";
import * as fs from "fs";

/**
 * Common function to resolve file and symbol position for LSP operations
 */
export function resolveFileAndSymbol(params: {
  root: string;
  relativePath: string;
  line?: number | string;
  symbolName?: string;
  textTarget?: string;
}) {
  const pathToUse = params.relativePath;
  if (!pathToUse) {
    throw new Error("relativePath must be provided");
  }
  const {
    content: fileContent,
    uri: fileUri,
    absolutePath,
  } = readFileWithUri(params.root, pathToUse);
  const lines = fileContent.split("\n");

  let lineIndex = 0;
  let symbolIndex = 0;

  if (params.line !== undefined) {
    if (typeof params.line === "number") {
      lineIndex = params.line - 1;
    } else {
      lineIndex = lines.findIndex((l: string) =>
        l.includes(params.line as string),
      );
      if (lineIndex === -1) {
        throw new Error(
          `Line containing "${params.line}" not found in ${pathToUse}`,
        );
      }
    }
  }

  if (params.symbolName) {
    const lineContent = lines[lineIndex];
    symbolIndex = lineContent.indexOf(params.symbolName);
    if (symbolIndex === -1) {
      throw new Error(
        `Symbol "${params.symbolName}" not found on line ${lineIndex + 1} in ${pathToUse}`,
      );
    }
  } else if (params.textTarget) {
    const targetText = params.textTarget;
    // If no line specified, search for target in entire file
    if (params.line === undefined) {
      for (let i = 0; i < lines.length; i++) {
        const idx = lines[i].indexOf(targetText!);
        if (idx !== -1) {
          lineIndex = i;
          symbolIndex = idx;
          break;
        }
      }
      if (symbolIndex === -1) {
        throw new Error(`Target "${targetText}" not found in ${pathToUse}`);
      }
    } else {
      // Search for target on specified line
      const lineContent = lines[lineIndex];
      symbolIndex = lineContent.indexOf(targetText!);
      if (symbolIndex === -1) {
        throw new Error(
          `Target "${targetText}" not found on line ${lineIndex + 1} in ${pathToUse}`,
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
/**
 * Read file content and generate file URI
 */
function readFileWithUri(
  root: string,
  relativePath: string,
): {
  content: string;
  uri: string;
  absolutePath: string;
} {
  const absolutePath = resolve(root, relativePath);

  try {
    const content = fs.readFileSync(absolutePath, "utf-8");
    const uri = pathToFileURL(absolutePath).toString();
    return { content, uri, absolutePath };
  } catch (error) {
    throw new Error(`File not found: ${relativePath}`);
  }
}

export function readFileWithMetadata(root: string, relativePath: string) {
  const {
    content: fileContent,
    uri: fileUri,
    absolutePath,
  } = readFileWithUri(root, relativePath);
  return { fileContent, fileUri, absolutePath };
}

/**
 * Common LSP operation wrapper for opening document, executing operation, and closing
 */
export async function withLSPDocument<T>(
  client: any,
  fileUri: string,
  content: string,
  operation: () => Promise<T>,
  delay: number = 500,
): Promise<T> {
  // Open the document in LSP
  client.openDocument(fileUri, content);

  try {
    // Wait a bit for LSP to process the document
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Execute the operation
    return await operation();
  } finally {
    // Close the document
    client.closeDocument(fileUri);
  }
}
