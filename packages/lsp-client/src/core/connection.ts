/**
 * LSP connection and message handling
 */

import type {
  LSPMessage,
  LSPRequest,
  LSPResponse,
  LSPNotification,
} from "../protocol/types/index.ts";
import {
  isLSPResponse,
  isLSPNotification,
  isLSPRequest,
} from "../protocol/types/index.ts";
import type { LSPProcessState } from "./state.ts";
import type { WorkspaceEdit } from "../protocol/types/index.ts";
import type { ApplyWorkspaceEditResponse } from "../protocol/types/responses.ts";
import { debug } from "../utils/debug.ts";

/** Server-to-client requests that only need an acknowledgement. */
const ACKNOWLEDGED_SERVER_REQUESTS = new Set([
  "client/unregisterCapability",
  "window/workDoneProgress/create",
  "workspace/codeLens/refresh",
  "workspace/diagnostic/refresh",
  "workspace/foldingRange/refresh",
  "workspace/inlayHint/refresh",
  "workspace/inlineValue/refresh",
  "workspace/semanticTokens/refresh",
]);

/** Dynamic registrations this client can honour: notifications it would send if the event happened. */
const HONOURED_REGISTRATIONS = new Set(["workspace/didChangeConfiguration"]);

export type ApplyEditHandler = (
  edit: WorkspaceEdit,
) => Promise<ApplyWorkspaceEditResponse>;

export class ConnectionHandler {
  /** Server requests are applied one at a time, in arrival order */
  private applyEditQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private state: LSPProcessState,
    private handlers: { applyEdit?: ApplyEditHandler } = {},
  ) {}

  /** Append raw stdout bytes and parse whatever frames are complete */
  receive(data: Buffer): void {
    this.state.chunks.push(data);
    this.state.bufferedBytes += data.length;
    this.processBuffer();
  }

  processBuffer(): void {
    for (;;) {
      if (this.state.contentLength === -1) {
        const joined = this.joinChunks();
        const headerEnd = joined.indexOf("\r\n\r\n");
        if (headerEnd === -1) {
          return;
        }
        const header = joined.subarray(0, headerEnd).toString("utf8");
        const contentLengthMatch = header.match(/Content-Length: (\d+)/);
        this.setChunks(joined.subarray(headerEnd + 4));
        if (!contentLengthMatch) {
          debug("Invalid LSP header:", header);
          continue;
        }
        this.state.contentLength = parseInt(contentLengthMatch[1], 10);
      }

      // Content-Length counts UTF-8 bytes
      if (this.state.bufferedBytes < this.state.contentLength) {
        return;
      }

      const joined = this.joinChunks();
      const messageBody = joined
        .subarray(0, this.state.contentLength)
        .toString("utf8");
      this.setChunks(joined.subarray(this.state.contentLength));
      this.state.contentLength = -1;

      try {
        const message = JSON.parse(messageBody) as LSPMessage;
        this.handleMessage(message);
      } catch (error) {
        debug("Failed to parse LSP message:", messageBody, error);
      }
    }
  }

  private joinChunks(): Buffer {
    if (this.state.chunks.length > 1) {
      this.state.chunks = [Buffer.concat(this.state.chunks)];
    }
    return this.state.chunks[0] ?? Buffer.alloc(0);
  }

  private setChunks(rest: Buffer): void {
    this.state.chunks = rest.length > 0 ? [rest] : [];
    this.state.bufferedBytes = rest.length;
  }

  private handleMessage(message: LSPMessage): void {
    debug(
      "[LSP message]",
      (message as any).method || `Response #${(message as any).id}`,
      (message as any).method ? "notification/request" : "response",
    );

    if (isLSPResponse(message)) {
      this.handleResponse(message as LSPResponse);
    } else if (isLSPNotification(message) || isLSPRequest(message)) {
      this.handleNotificationOrRequest(message as LSPNotification | LSPRequest);
    }
  }

  private handleResponse(message: LSPResponse): void {
    const handler = this.state.responseHandlers.get(message.id);
    debug(
      `[LSP response] id=${message.id}, has handler=${!!handler}, pending handlers=${Array.from(this.state.responseHandlers.keys()).join(", ")}`,
    );

    if (handler) {
      clearTimeout(handler.timer);
      this.state.responseHandlers.delete(message.id);

      if (message.error) {
        handler.reject(new Error(message.error.message));
      } else {
        handler.resolve(message.result);
      }
    } else {
      debug(`[LSP response] No handler found for response id ${message.id}`);
    }
  }

  private handleNotificationOrRequest(
    message: LSPNotification | LSPRequest,
  ): void {
    // Handle diagnostics notification
    if (
      message.method === "textDocument/publishDiagnostics" &&
      message.params
    ) {
      const params = message.params as any;
      if (params?.uri && params?.diagnostics) {
        const validDiagnostics = params.diagnostics.filter(
          (d: any) => d && d.range,
        );
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
      this.sendResponse((message as LSPRequest).id, configurations);
    } else if (isLSPRequest(message)) {
      if (message.method === "workspace/applyEdit") {
        this.handleApplyEdit(message);
      } else if (message.method === "client/registerCapability") {
        const registrations =
          (message.params as { registrations?: Array<{ method: string }> })
            ?.registrations ?? [];
        const unsupported = registrations
          .map((r) => r.method)
          .filter((method) => !HONOURED_REGISTRATIONS.has(method));
        if (unsupported.length === 0) {
          this.sendResponse(message.id, null);
        } else {
          this.sendError(
            message.id,
            -32602,
            `Cannot honour registration of: ${unsupported.join(", ")}`,
          );
        }
      } else if (ACKNOWLEDGED_SERVER_REQUESTS.has(message.method)) {
        this.sendResponse(message.id, null);
      } else {
        this.sendError(
          message.id,
          -32601,
          `Method not found: ${message.method}`,
        );
      }
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

      try {
        this.sendMessage(request);
      } catch (error) {
        reject(error);
        return;
      }

      const timer = setTimeout(() => {
        this.state.responseHandlers.delete(id);
        reject(new Error(`LSP request timeout: ${method}`));
      }, timeout);

      this.state.responseHandlers.set(id, { resolve, reject, timer });
    });
  }

  /** Fails every request still waiting for a response */
  rejectPendingRequests(error: Error): void {
    for (const handler of this.state.responseHandlers.values()) {
      clearTimeout(handler.timer);
      handler.reject(error);
    }
    this.state.responseHandlers.clear();
  }

  sendNotification(method: string, params?: unknown): void {
    const notification: LSPNotification = {
      jsonrpc: "2.0",
      method,
      params: params as Record<string, unknown>,
    };
    this.sendMessage(notification);
  }

  private handleApplyEdit(message: LSPRequest): void {
    const handler = this.handlers.applyEdit;
    if (!handler) {
      this.sendError(
        message.id,
        -32601,
        "Method not found: workspace/applyEdit",
      );
      return;
    }
    const edit = (message.params as { edit?: WorkspaceEdit } | undefined)?.edit;
    if (!edit) {
      this.sendError(
        message.id,
        -32602,
        "workspace/applyEdit: params.edit is required",
      );
      return;
    }
    this.applyEditQueue = this.applyEditQueue
      .then(() => handler(edit))
      .then(
        (result) => this.sendResponse(message.id, result),
        (error: unknown) =>
          this.sendError(
            message.id,
            -32603,
            error instanceof Error ? error.message : String(error),
          ),
      )
      .catch((error: unknown) =>
        debug("workspace/applyEdit response failed:", error),
      );
  }

  private sendError(id: number | string, code: number, message: string): void {
    const response: LSPResponse = {
      jsonrpc: "2.0",
      id,
      error: { code, message },
    };
    this.sendMessage(response);
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
