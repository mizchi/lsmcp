/**
 * LSP-based symbol provider for code indexing
 */

import type { LSPClient } from "./protocol/types/index.ts";
import type { DocumentSymbol } from "@lsmcp/types";
import { fixFSharpSymbolPositions } from "./fsharp-position-fix.ts";

/**
 * Symbol provider interface required by code-indexer
 */
export interface SymbolProvider {
  getDocumentSymbols(uri: string): Promise<DocumentSymbol[]>;
}

/**
 * LSP implementation of SymbolProvider
 */
export class LSPSymbolProvider implements SymbolProvider {
  constructor(
    private client: LSPClient,
    private fileContentProvider: (uri: string) => Promise<string>,
    private languageId?: string,
  ) {}

  async getDocumentSymbols(uri: string): Promise<DocumentSymbol[]> {
    try {
      // Get file content
      const content = await this.fileContentProvider(uri);

      console.error(`[LSPSymbolProvider] Getting symbols for ${uri}`);

      // Open document temporarily
      this.client.openDocument(uri, content);

      try {
        // Wait a bit for LSP to process
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Get symbols
        let symbols = await this.client.getDocumentSymbols(uri);
        console.error(
          `[LSPSymbolProvider] Got ${symbols.length} symbols from ${uri}`,
        );

        // Apply F# position fix if needed
        if (
          this.languageId === "fsharp" &&
          (uri.endsWith(".fs") || uri.endsWith(".fsi") || uri.endsWith(".fsx"))
        ) {
          symbols = fixFSharpSymbolPositions(
            symbols as DocumentSymbol[],
            content,
          );
        }

        // Cast to DocumentSymbol[] as code-indexer expects
        return symbols as DocumentSymbol[];
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

/**
 * Create an LSP-based symbol provider
 */
export function createLSPSymbolProvider(
  client: LSPClient,
  fileContentProvider: (uri: string) => Promise<string>,
  languageId?: string,
): SymbolProvider {
  return new LSPSymbolProvider(client, fileContentProvider, languageId);
}
