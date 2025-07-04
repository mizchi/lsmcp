/**
 * LSP diagnostics management
 */

import { EventEmitter } from "events";
import type {
  Diagnostic,
  PublishDiagnosticsParams,
  ServerCapabilities,
} from "../lspTypes.ts";
import { debug } from "../../mcp/utils/mcpHelpers.ts";

// Type for LSP 3.17+ pull diagnostics
interface DocumentDiagnosticReport {
  kind: "full" | "unchanged";
  items?: Diagnostic[];
  resultId?: string;
}

const debugLog = (message: string, ...args: unknown[]) => {
  debug(`[lspClient] ${message}`, ...args);
};

export class DiagnosticsManager {
  private diagnostics = new Map<string, Diagnostic[]>();
  private eventEmitter: EventEmitter;

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
  }

  /**
   * Handle incoming diagnostics from the server
   */
  handlePublishDiagnostics(params: PublishDiagnosticsParams): void {
    debugLog("Received diagnostics:", {
      uri: params.uri,
      count: params.diagnostics?.length || 0,
    });

    this.diagnostics.set(params.uri, params.diagnostics || []);
    this.eventEmitter.emit("diagnostics", params);
  }

  /**
   * Get stored diagnostics for a document
   */
  getDiagnostics(uri: string): Diagnostic[] {
    return this.diagnostics.get(uri) || [];
  }

  /**
   * Clear diagnostics for a document
   */
  clearDiagnostics(uri: string): void {
    this.diagnostics.delete(uri);
  }

  /**
   * Clear all diagnostics
   */
  clearAllDiagnostics(): void {
    this.diagnostics.clear();
  }

  /**
   * Wait for diagnostics to arrive (event-driven)
   */
  waitForDiagnostics(
    fileUri: string,
    timeout: number = 2000,
  ): Promise<Diagnostic[]> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined;

      const diagnosticsHandler = (params: PublishDiagnosticsParams) => {
        if (params.uri === fileUri) {
          if (timeoutId) clearTimeout(timeoutId);
          this.eventEmitter.off("diagnostics", diagnosticsHandler);
          resolve(params.diagnostics || []);
        }
      };

      // Set up timeout
      timeoutId = setTimeout(() => {
        this.eventEmitter.off("diagnostics", diagnosticsHandler);
        reject(new Error(`Timeout waiting for diagnostics for ${fileUri}`));
      }, timeout);

      // Listen for diagnostics
      this.eventEmitter.on("diagnostics", diagnosticsHandler);
    });
  }

  /**
   * Get diagnostic support information from server capabilities
   */
  static getDiagnosticSupport(serverCapabilities?: ServerCapabilities): {
    pushDiagnostics: boolean;
    pullDiagnostics: boolean;
  } {
    if (!serverCapabilities) {
      return { pushDiagnostics: true, pullDiagnostics: false };
    }

    const hasPullDiagnostics = !!(
      serverCapabilities.diagnosticProvider ||
      (serverCapabilities as any).textDocument?.diagnostic
    );

    // Push diagnostics are always supported in LSP
    const hasPushDiagnostics = true;

    return {
      pushDiagnostics: hasPushDiagnostics,
      pullDiagnostics: hasPullDiagnostics,
    };
  }

  /**
   * Pull diagnostics from the server (LSP 3.17+)
   */
  async pullDiagnostics(
    uri: string,
    sendRequest: <T>(method: string, params: unknown) => Promise<T>,
  ): Promise<Diagnostic[]> {
    try {
      const params = {
        textDocument: { uri },
      };

      const result = await sendRequest<DocumentDiagnosticReport>(
        "textDocument/diagnostic",
        params,
      );

      if (result.kind === "full" && result.items) {
        // Store the diagnostics
        this.diagnostics.set(uri, result.items);
        return result.items;
      }

      return [];
    } catch (error) {
      debugLog("Pull diagnostics not supported:", error);
      // Fall back to stored diagnostics
      return this.getDiagnostics(uri);
    }
  }
}
