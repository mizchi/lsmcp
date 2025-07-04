import { getLSPClient } from "../lspClient.ts";
import { ErrorContext, formatError } from "../../mcp/utils/errorHandler.ts";

/**
 * Execute an operation with a temporarily opened LSP document
 *
 * This function handles the lifecycle of opening and closing a document
 * in the LSP server, ensuring proper cleanup even if the operation fails.
 *
 * @param fileUri - File URI for the document
 * @param content - Content of the document
 * @param operation - Async operation to execute while document is open
 * @param language - Optional language ID for the document
 * @returns Result of the operation
 */
export async function withTemporaryDocument<T>(
  fileUri: string,
  content: string,
  operation: () => Promise<T>,
  language?: string,
): Promise<T> {
  const client = getLSPClient();
  if (!client) {
    const context: ErrorContext = {
      operation: "LSP document operation",
      language,
    };
    throw new Error(
      formatError(
        new Error(
          "LSP client not initialized. Ensure the language server is started.",
        ),
        context,
      ),
    );
  }

  // Open the document in LSP with language ID if provided
  client.openDocument(fileUri, content, language);

  try {
    // Wait a bit for LSP to process the document
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Execute the operation
    return await operation();
  } finally {
    // Always close the document
    client.closeDocument(fileUri);
  }
}
