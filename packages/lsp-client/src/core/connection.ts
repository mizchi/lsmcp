/**
 * LSP connection and message handling
 */

import type {
  LSPMessage,
  LSPRequest,
  LSPResponse,
  LSPNotification,
  isPublishDiagnosticsParams,
  PublishDiagnosticsParams,
} from "../protocol/types/index.ts";
import type { LSPClientState } from "./state.ts";
import { debug } from "../utils/debug.ts";

export class ConnectionHandler {
  constructor(private state: LSPClientState) {}

  processBuffer(): void {
    while (this.state.buffer.length > 0) {
      if (this.state.contentLength === -1) {
        // Look for Content-Length header
        const headerEnd = this.state.buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) {
          return;
        }

        const header = this.state.buffer.substring(0, headerEnd);
        const contentLengthMatch = header.match(/Content-Length: (\d+)/);
        if (!contentLengthMatch) {
          debug("Invalid LSP header:", header);
          this.state.buffer = this.state.buffer.substring(headerEnd + 4);
          continue;
        }

        this.state.contentLength = parseInt(contentLengthMatch[1], 10);
        this.state.buffer = this.state.buffer.substring(headerEnd + 4);
      }

      if (this.state.buffer.length < this.state.contentLength) {
        // Wait for more data
        return;
      }

      const messageBody = this.state.buffer.substring(
        0,
        this.state.contentLength,
      );
      this.state.buffer = this.state.buffer.substring(this.state.contentLength);
      this.state.contentLength = -1;

      try {
        const message = JSON.parse(messageBody) as LSPMessage;
        this.handleMessage(message);
      } catch (error) {
        debug("Failed to parse LSP message:", messageBody, error);
      }
    }
  }

  private handleMessage(message: LSPMessage): void {
    const {
      isLSPResponse,
      isLSPNotification,
      isLSPRequest,
      isPublishDiagnosticsParams,
    } = require("../protocol/types/index.ts");

    if (isLSPResponse(message)) {
      this.handleResponse(message);
    } else if (isLSPNotification(message) || isLSPRequest(message)) {
      this.handleNotificationOrRequest(message);
    }
  }

  private handleResponse(message: LSPResponse): void {
    const handler = this.state.responseHandlers.get(message.id);
    if (handler) {
      if (handler.timer) {
        clearTimeout(handler.timer);
      }
      this.state.responseHandlers.delete(message.id);

      if (message.error) {
        handler.reject(new Error(message.error.message));
      } else {
        handler.resolve(message.result);
      }
    }
  }

  private handleNotificationOrRequest(
    message: LSPNotification | LSPRequest,
  ): void {
    const { isLSPRequest, isPublishDiagnosticsParams } =
      require("../protocol/types/index.ts");

    // Handle diagnostics notification
    if (
      message.method === "textDocument/publishDiagnostics" &&
      message.params
    ) {
      if (isPublishDiagnosticsParams(message.params)) {
        const params = message.params as PublishDiagnosticsParams;
        const validDiagnostics = params.diagnostics.filter((d) => d && d.range);
        this.state.diagnostics.set(params.uri, validDiagnostics);
        this.state.eventEmitter.emit("diagnostics", {
          ...params,
          diagnostics: validDiagnostics,
        });
      }
    }

    // Handle workspace/configuration request
    if (
      isLSPRequest(message) &&
      message.method === "workspace/configuration" &&
      message.params
    ) {
      const params = message.params as { items: Array<{ section?: string }> };
      const configurations = params.items.map((item) => {
        if (item.section === "deno") {
          return {
            enable: true,
            lint: true,
            unstable: true,
          };
        }
        return {};
      });
      this.sendResponse(message.id, configurations);
    }

    this.state.eventEmitter.emit("message", message);
  }

  sendMessage(message: LSPMessage): void {
    if (!this.state.process) {
      throw new Error("LSP server not started");
    }
    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
    this.state.process.stdin?.write(header + content);
  }

  sendRequest<T = unknown>(
    method: string,
    params?: unknown,
    timeout: number = 30000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++this.state.messageId;
      const request: LSPRequest = {
        jsonrpc: "2.0",
        id,
        method,
        params: params as Record<string, unknown>,
      };

      const timer = setTimeout(() => {
        this.state.responseHandlers.delete(id);
        reject(new Error(`LSP request timeout: ${method}`));
      }, timeout);

      this.state.responseHandlers.set(id, { resolve, reject, timer });
      this.sendMessage(request);
    });
  }

  sendNotification(method: string, params?: unknown): void {
    const notification: LSPNotification = {
      jsonrpc: "2.0",
      method,
      params: params as Record<string, unknown>,
    };
    this.sendMessage(notification);
  }

  private sendResponse(id: number | string, result: unknown): void {
    const response: LSPResponse = {
      jsonrpc: "2.0",
      id,
      result,
    };
    this.sendMessage(response);
  }
}
