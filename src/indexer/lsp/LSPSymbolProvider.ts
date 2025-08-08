/**
 * LSP-based symbol provider
 */

import type { SymbolProvider } from "../engine/types.ts";
import type { LSPClient } from "../../lsp/lspTypes.ts";
// import { withTemporaryDocument } from "../../lsp/utils/documentManager.ts";

export class LSPSymbolProvider implements SymbolProvider {
  constructor(
    private client: LSPClient,
    private fileContentProvider: (uri: string) => Promise<string>,
  ) {}

  async getDocumentSymbols(uri: string): Promise<any[]> {
    try {
      // Get file content
      const content = await this.fileContentProvider(uri);

      console.error(`[LSPSymbolProvider] Getting symbols for ${uri}`);

      // Open document temporarily
      this.client.openDocument(uri, content);

      try {
        // Wait a bit for LSP to process (reduced from 1000ms to 200ms)
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Get symbols
        const symbols = await this.client.getDocumentSymbols(uri);
        console.error(
          `[LSPSymbolProvider] Got ${symbols.length} symbols from ${uri}`,
        );
        return symbols;
      } finally {
        // Always close document
        this.client.closeDocument(uri);
      }
    } catch (error) {
      // Log error but return empty array instead of throwing
      // This prevents cascading failures during incremental updates
      console.error(
        `[LSPSymbolProvider] Error getting symbols for ${uri}:`,
        error,
      );
      // Return empty array for files that can't be processed
      return [];
    }
  }
}
