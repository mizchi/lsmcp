/**
 * LSP request/response management
 */

import type { LSPNotification, LSPRequest, LSPResponse } from "../lspTypes.ts";
import { debug } from "../../mcp/utils/mcpHelpers.ts";

const debugLog = (message: string, ...args: unknown[]) => {
  debug(`[lspClient] ${message}`, ...args);
};

type ResponseHandler = {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export class RequestManager {
  private requestId = 1;
  private responseHandlers = new Map<number, ResponseHandler>();

  /**
   * Send an LSP request and wait for response
   */
  async sendRequest<T>(
    method: string,
    params: unknown,
    sendMessage: (message: unknown) => void,
    timeout = 60000,
  ): Promise<T> {
    const id = this.requestId++;
    const request: LSPRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params: params as Record<string, unknown>,
    };

    debugLog(`Sending request: ${method}`, params);

    return new Promise<T>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.responseHandlers.delete(id);
        reject(new Error(`Request ${method} timed out after ${timeout}ms`));
      }, timeout);

      this.responseHandlers.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timeout: timeoutHandle,
      });

      sendMessage(request);
    });
  }

  /**
   * Send an LSP notification (no response expected)
   */
  sendNotification(
    method: string,
    params: unknown,
    sendMessage: (message: unknown) => void,
  ): void {
    const notification: LSPNotification = {
      jsonrpc: "2.0",
      method,
      params: params as Record<string, unknown>,
    };
    debugLog(`Sending notification: ${method}`, params);
    sendMessage(notification);
  }

  /**
   * Handle an incoming response
   */
  handleResponse(response: LSPResponse): void {
    const handler = this.responseHandlers.get(response.id as number);
    if (!handler) {
      debugLog(`No handler for response ID ${response.id}`);
      return;
    }

    this.responseHandlers.delete(response.id as number);
    clearTimeout(handler.timeout);

    if ("error" in response && response.error) {
      const error = new Error(response.error.message);
      (error as any).code = response.error.code;
      (error as any).data = response.error.data;
      handler.reject(error);
    } else {
      handler.resolve(response.result);
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests(): void {
    for (const [, handler] of this.responseHandlers) {
      clearTimeout(handler.timeout);
      handler.reject(new Error("Request cancelled"));
    }
    this.responseHandlers.clear();
  }

  /**
   * Get number of pending requests
   */
  getPendingRequestCount(): number {
    return this.responseHandlers.size;
  }
}
