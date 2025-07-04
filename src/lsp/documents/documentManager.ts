/**
 * LSP document management
 */

import type {
  DidOpenTextDocumentParams,
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  VersionedTextDocumentIdentifier,
} from "../lspTypes.ts";

export class DocumentManager {
  private openDocuments = new Set<string>();
  private documentVersions = new Map<string, number>();

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
    this.openDocuments.add(uri);
    this.documentVersions.set(uri, 1);
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
    this.documentVersions.delete(uri);
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
    if (!this.openDocuments.has(uri)) {
      throw new Error(`Document ${uri} is not open`);
    }

    const currentVersion = this.documentVersions.get(uri) || 1;
    const newVersion = version ?? currentVersion + 1;

    const params: DidChangeTextDocumentParams = {
      textDocument: {
        uri,
        version: newVersion,
      } as VersionedTextDocumentIdentifier,
      contentChanges: [{ text: content }],
    };

    sendNotification("textDocument/didChange", params);
    this.documentVersions.set(uri, newVersion);
  }

  /**
   * Check if a document is open
   */
  isDocumentOpen(uri: string): boolean {
    return this.openDocuments.has(uri);
  }

  /**
   * Get all open documents
   */
  getOpenDocuments(): string[] {
    return Array.from(this.openDocuments);
  }

  /**
   * Close all documents
   */
  closeAllDocuments(
    sendNotification: (method: string, params: unknown) => void,
  ): void {
    for (const uri of this.openDocuments) {
      this.closeDocument(uri, sendNotification);
    }
  }

  /**
   * Get document version
   */
  getDocumentVersion(uri: string): number | undefined {
    return this.documentVersions.get(uri);
  }
}
