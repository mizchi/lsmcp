/**
 * LSP document management
 */

import type {
  DidOpenTextDocumentParams,
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  VersionedTextDocumentIdentifier,
} from "../protocol/types/index.ts";

interface OpenDocument {
  version: number;
  /** The text the server was last given */
  text: string;
}

export class DocumentManager {
  private openDocuments = new Map<string, OpenDocument>();

  /**
   * Open a document in the LSP server
   */
  openDocument(
    uri: string,
    content: string,
    sendNotification: (method: string, params: unknown) => void,
    languageId?: string,
  ): void {
    if (this.openDocuments.has(uri)) {
      return; // Already open
    }

    const params: DidOpenTextDocumentParams = {
      textDocument: {
        uri,
        languageId: languageId || "typescript",
        version: 1,
        text: content,
      },
    };

    sendNotification("textDocument/didOpen", params);
    this.openDocuments.set(uri, { version: 1, text: content });
  }

  /**
   * Close a document in the LSP server
   */
  closeDocument(
    uri: string,
    sendNotification: (method: string, params: unknown) => void,
  ): void {
    if (!this.openDocuments.has(uri)) {
      return; // Not open
    }

    const params: DidCloseTextDocumentParams = {
      textDocument: { uri },
    };

    sendNotification("textDocument/didClose", params);
    this.openDocuments.delete(uri);
  }

  /**
   * Update document content
   */
  updateDocument(
    uri: string,
    content: string,
    sendNotification: (method: string, params: unknown) => void,
    version?: number,
  ): void {
    const document = this.openDocuments.get(uri);
    if (!document) {
      throw new Error(`Document ${uri} is not open`);
    }

    const newVersion = version ?? document.version + 1;

    const params: DidChangeTextDocumentParams = {
      textDocument: {
        uri,
        version: newVersion,
      } as VersionedTextDocumentIdentifier,
      contentChanges: [{ text: content }],
    };

    sendNotification("textDocument/didChange", params);
    this.openDocuments.set(uri, { version: newVersion, text: content });
  }

  /**
   * Check if a document is open
   */
  isDocumentOpen(uri: string): boolean {
    return this.openDocuments.has(uri);
  }

  getDocumentText(uri: string): string | undefined {
    return this.openDocuments.get(uri)?.text;
  }

  /**
   * Get all open documents
   */
  getOpenDocuments(): string[] {
    return Array.from(this.openDocuments.keys());
  }

  /**
   * Close all documents
   */
  closeAllDocuments(
    sendNotification: (method: string, params: unknown) => void,
  ): void {
    for (const uri of this.openDocuments.keys()) {
      this.closeDocument(uri, sendNotification);
    }
  }
}
