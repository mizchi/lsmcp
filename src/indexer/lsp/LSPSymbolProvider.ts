/**
 * LSP-based symbol provider
 */

import type { SymbolProvider } from "../core/types.ts";
import type { LSPClient } from "../../lsp/lspTypes.ts";
// import { withTemporaryDocument } from "../../lsp/utils/documentManager.ts";

export class LSPSymbolProvider implements SymbolProvider {
  constructor(
    private client: LSPClient,
    private fileContentProvider: (uri: string) => Promise<string>,
  ) {}

  async getDocumentSymbols(uri: string): Promise<any[]> {
    // Get file content
    const content = await this.fileContentProvider(uri);

    // Open document temporarily
    this.client.openDocument(uri, content);

    try {
      // Wait a bit for LSP to process
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get symbols
      return await this.client.getDocumentSymbols(uri);
    } finally {
      // Always close document
      this.client.closeDocument(uri);
    }
  }
}
