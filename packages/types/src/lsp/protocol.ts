// LSP Protocol Types

export interface LSPRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: any;
}

export interface LSPResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface LSPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: any;
}

export type LSPMessage = LSPRequest | LSPResponse | LSPNotification;

// Type guards
export function isLSPRequest(message: any): message is LSPRequest {
  return (
    message &&
    message.jsonrpc === "2.0" &&
    message.id !== undefined &&
    message.method !== undefined
  );
}

export function isLSPResponse(message: any): message is LSPResponse {
  return (
    message &&
    message.jsonrpc === "2.0" &&
    message.id !== undefined &&
    (message.result !== undefined || message.error !== undefined)
  );
}

export function isLSPNotification(message: any): message is LSPNotification {
  return (
    message &&
    message.jsonrpc === "2.0" &&
    message.id === undefined &&
    message.method !== undefined
  );
}

// Protocol constants
export const LSPMethods = {
  // Lifecycle
  INITIALIZE: "initialize",
  INITIALIZED: "initialized",
  SHUTDOWN: "shutdown",
  EXIT: "exit",

  // Document synchronization
  DID_OPEN: "textDocument/didOpen",
  DID_CHANGE: "textDocument/didChange",
  DID_CLOSE: "textDocument/didClose",
  DID_SAVE: "textDocument/didSave",

  // Language features
  COMPLETION: "textDocument/completion",
  COMPLETION_RESOLVE: "completionItem/resolve",
  HOVER: "textDocument/hover",
  SIGNATURE_HELP: "textDocument/signatureHelp",
  DECLARATION: "textDocument/declaration",
  DEFINITION: "textDocument/definition",
  TYPE_DEFINITION: "textDocument/typeDefinition",
  IMPLEMENTATION: "textDocument/implementation",
  REFERENCES: "textDocument/references",
  DOCUMENT_HIGHLIGHT: "textDocument/documentHighlight",
  DOCUMENT_SYMBOL: "textDocument/documentSymbol",
  CODE_ACTION: "textDocument/codeAction",
  CODE_LENS: "textDocument/codeLens",
  CODE_LENS_RESOLVE: "codeLens/resolve",
  DOCUMENT_LINK: "textDocument/documentLink",
  DOCUMENT_LINK_RESOLVE: "documentLink/resolve",
  DOCUMENT_COLOR: "textDocument/documentColor",
  COLOR_PRESENTATION: "textDocument/colorPresentation",
  FORMATTING: "textDocument/formatting",
  RANGE_FORMATTING: "textDocument/rangeFormatting",
  ON_TYPE_FORMATTING: "textDocument/onTypeFormatting",
  RENAME: "textDocument/rename",
  PREPARE_RENAME: "textDocument/prepareRename",
  FOLDING_RANGE: "textDocument/foldingRange",
  SELECTION_RANGE: "textDocument/selectionRange",

  // Workspace features
  WORKSPACE_SYMBOL: "workspace/symbol",
  WORKSPACE_EXECUTE_COMMAND: "workspace/executeCommand",
  WORKSPACE_APPLY_EDIT: "workspace/applyEdit",

  // Diagnostics
  PUBLISH_DIAGNOSTICS: "textDocument/publishDiagnostics",
  PULL_DIAGNOSTICS: "textDocument/diagnostic",
} as const;

export type LSPMethod = (typeof LSPMethods)[keyof typeof LSPMethods];
