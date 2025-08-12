import type { LSPClient } from "../protocol/types-legacy.ts";

/**
 * Options for LSP operations
 */
export interface LSPOperationOptions<T> {
  /** LSP client instance to use */
  client: LSPClient;

  /** File URI for the document */
  fileUri: string;

  /** File content to open in LSP */
  fileContent: string;

  /** Language ID (default: from client) */
  languageId?: string;

  /** Wait time after opening document (ms) */
  waitTime?: number;

  /** Timeout for the operation (ms) */
  timeout?: number;

  /** The actual LSP operation to perform */
  operation: (client: LSPClient) => Promise<T>;

  /** Error context for better error messages */
  errorContext?: any;

  /** Override server characteristics for this operation */
  serverCharacteristics?: any;
}

/**
 * Executes an LSP operation with proper document lifecycle management
 *
 * @example
 * ```typescript
 * const hover = await withLSPOperation({
 *   client: myLspClient,
 *   fileUri: "file:///path/to/file.ts",
 *   fileContent: content,
 *   operation: (client) => client.getHover(fileUri, position),
 *   errorContext: { filePath: "file.ts", operation: "hover" }
 * });
 * ```
 */
export async function withLSPOperation<T>(
  options: LSPOperationOptions<T>,
): Promise<T> {
  const { client } = options;

  if (!client) {
    throw new Error(
      `LSP client not provided for language: ${options.errorContext?.language || "unknown"}`,
    );
  }

  // Default characteristics
  const defaultCharacteristics = {
    documentOpenDelay: 100,
    operationTimeout: 5000,
  };

  const characteristics =
    options.serverCharacteristics || defaultCharacteristics;

  const {
    fileUri,
    fileContent,
    languageId,
    waitTime = characteristics.documentOpenDelay,
    timeout = characteristics.operationTimeout,
    operation,
    errorContext: _errorContext = {},
  } = options;

  // Open document with proper language ID
  const actualLanguageId = languageId || client.languageId || "plaintext";
  client.openDocument(fileUri, fileContent, actualLanguageId);

  // Wait for LSP to process the document
  if (waitTime > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, waitTime));
  }

  // Execute the operation with timeout
  const operationPromise = operation(client);

  // Add timeout wrapper
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`LSP operation timed out after ${timeout}ms`));
    }, timeout);
  });

  return Promise.race([operationPromise, timeoutPromise]);
}

/**
 * Options for batch LSP operations
 */
export interface BatchLSPOperationOptions<T> {
  /** LSP client instance to use */
  client: LSPClient;

  /** List of file URIs and contents */
  files: Array<{
    fileUri: string;
    fileContent: string;
  }>;

  /** Language ID for all files */
  languageId?: string;

  /** Wait time after opening all documents (ms) */
  waitTime?: number;

  /** The batch operation to perform */
  operation: (client: LSPClient) => Promise<T>;

  /** Error context */
  errorContext?: any;
}

/**
 * Executes an LSP operation on multiple files
 *
 * @example
 * ```typescript
 * const diagnostics = await withBatchLSPOperation({
 *   client: myLspClient,
 *   files: fileList.map(f => ({ fileUri: f.uri, fileContent: f.content })),
 *   operation: async (client) => {
 *     const results = [];
 *     for (const file of fileList) {
 *       results.push(await client.getDiagnostics(file.uri));
 *     }
 *     return results;
 *   }
 * });
 * ```
 */
export async function withBatchLSPOperation<T>(
  options: BatchLSPOperationOptions<T>,
): Promise<T> {
  const { client } = options;

  if (!client) {
    throw new Error(
      `LSP client not provided for language: ${options.errorContext?.language || "unknown"}`,
    );
  }

  // Default characteristics
  const defaultCharacteristics = {
    documentOpenDelay: 100,
  };

  const characteristics = defaultCharacteristics;

  const {
    files,
    languageId,
    waitTime = characteristics.documentOpenDelay,
    operation,
    errorContext: _errorContext = {},
  } = options;

  // Open all documents
  const actualLanguageId = languageId || client.languageId || "plaintext";
  for (const { fileUri, fileContent } of files) {
    client.openDocument(fileUri, fileContent, actualLanguageId);
  }

  // Wait for LSP to process all documents
  if (waitTime > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, waitTime));
  }

  // Execute the operation
  return operation(client);
}
