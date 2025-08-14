/**
 * Base LSP protocol types
 */

// LSP Message types
export interface LSPRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface LSPResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface LSPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

export type LSPMessage = LSPRequest | LSPResponse | LSPNotification;

// Type guards
export function isLSPRequest(message: LSPMessage): message is LSPRequest {
  return "method" in message && "id" in message;
}

export function isLSPResponse(message: LSPMessage): message is LSPResponse {
  return "id" in message && ("result" in message || "error" in message);
}

export function isLSPNotification(
  message: LSPMessage,
): message is LSPNotification {
  return "method" in message && !("id" in message);
}

// Re-export commonly used types from @internal/types
export {
  CodeAction,
  Command,
  CompletionItem,
  CompletionList,
  Diagnostic,
  DocumentSymbol,
  DocumentUri,
  FormattingOptions,
  Hover,
  integer,
  Location,
  LocationLink,
  MarkedString,
  MarkupContent,
  Position,
  Range,
  SymbolInformation,
  TextEdit,
  WorkspaceEdit,
} from "@internal/types";

// Type aliases need to be exported separately
export type { Definition, SignatureHelp } from "@internal/types";
