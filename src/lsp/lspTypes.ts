import {
  CodeAction,
  Command,
  CompletionItem,
  CompletionList,
  Definition,
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
  SignatureHelp,
  SymbolInformation,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver-types";

// Re-export commonly used types
export {
  CodeAction,
  Command,
  CompletionItem,
  Diagnostic,
  DocumentSymbol,
  Location,
  LocationLink,
  Position,
  Range,
  SymbolInformation,
  TextEdit,
  WorkspaceEdit,
};
import { ChildProcess } from "child_process";
import { EventEmitter } from "events";

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

// LSP Protocol types
export interface TextDocumentIdentifier {
  uri: DocumentUri;
}

export interface TextDocumentPositionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

export interface PublishDiagnosticsParams {
  uri: DocumentUri;
  diagnostics: Diagnostic[];
}

export interface ReferenceContext {
  includeDeclaration: boolean;
}

export interface ReferenceParams extends TextDocumentPositionParams {
  context: ReferenceContext;
}

export interface ClientCapabilities {
  textDocument?: {
    synchronization?: {
      dynamicRegistration?: boolean;
      willSave?: boolean;
      willSaveWaitUntil?: boolean;
      didSave?: boolean;
    };
    publishDiagnostics?: {
      relatedInformation?: boolean;
    };
    definition?: {
      linkSupport?: boolean;
    };
    references?: Record<string, unknown>;
    hover?: {
      contentFormat?: string[];
    };
    completion?: {
      completionItem?: {
        snippetSupport?: boolean;
      };
    };
    documentSymbol?: {
      hierarchicalDocumentSymbolSupport?: boolean;
    };
  };
  workspace?: {
    workspaceFolders?: boolean;
    configuration?: boolean;
  };
}

export interface InitializeParams {
  processId: number | null;
  clientInfo?: {
    name: string;
    version?: string;
  };
  locale?: string;
  rootPath?: string | null;
  rootUri: DocumentUri | null;
  workspaceFolders?: WorkspaceFolder[] | null;
  capabilities: ClientCapabilities;
  initializationOptions?: Record<string, unknown>;
}

export interface WorkspaceFolder {
  uri: DocumentUri;
  name: string;
}

export interface ServerCapabilities {
  textDocumentSync?:
    | number
    | {
        openClose?: boolean;
        change?: number;
        save?: boolean | { includeText?: boolean };
      };
  hoverProvider?: boolean;
  definitionProvider?: boolean;
  referencesProvider?: boolean;
  workspaceSymbolProvider?: boolean;
  documentSymbolProvider?: boolean;
  completionProvider?:
    | boolean
    | {
        resolveProvider?: boolean;
        triggerCharacters?: string[];
      };
  signatureHelpProvider?: {
    triggerCharacters?: string[];
    retriggerCharacters?: string[];
  };
  documentFormattingProvider?: boolean;
  documentRangeFormattingProvider?: boolean;
  renameProvider?:
    | boolean
    | {
        prepareProvider?: boolean;
      };
  codeActionProvider?:
    | boolean
    | {
        codeActionKinds?: string[];
      };
  diagnosticProvider?: {
    identifier?: string;
    interFileDependencies?: boolean;
    workspaceDiagnostics?: boolean;
  };
  textDocument?: {
    diagnostic?: {
      dynamicRegistration?: boolean;
    };
  };
  workspace?: {
    workspaceFolders?: {
      supported?: boolean;
      changeNotifications?: boolean | string;
    };
    fileOperations?: {
      willRename?: {
        filters: Array<{
          scheme?: string;
          pattern: {
            glob: string;
            matches?: string;
          };
        }>;
      };
      didCreate?: any;
      didRename?: any;
      didDelete?: any;
    };
  };
  [key: string]: unknown;
}

export interface InitializeResult {
  capabilities: ServerCapabilities;
  serverInfo?: {
    name: string;
    version?: string;
  };
}

export interface TextDocumentItem {
  uri: DocumentUri;
  languageId: string;
  version: integer;
  text: string;
}

export interface DidOpenTextDocumentParams {
  textDocument: TextDocumentItem;
}

export interface VersionedTextDocumentIdentifier
  extends TextDocumentIdentifier {
  version: integer;
}

export interface TextDocumentContentChangeEvent {
  text: string;
}

export interface DidChangeTextDocumentParams {
  textDocument: VersionedTextDocumentIdentifier;
  contentChanges: TextDocumentContentChangeEvent[];
}

export interface DidCloseTextDocumentParams {
  textDocument: TextDocumentIdentifier;
}

// Workspace Edit types
export interface ApplyWorkspaceEditParams {
  label?: string;
  edit: WorkspaceEdit;
}

export interface ApplyWorkspaceEditResponse {
  applied: boolean;
  failureReason?: string;
  failedChange?: integer;
}

// Type aliases
export type HoverResult = Hover | null;
export type DefinitionResult =
  | Definition
  | Location
  | Location[]
  | LocationLink[]
  | null;
export type ReferencesResult = Location[] | null;
export type DocumentSymbolResult =
  | DocumentSymbol[]
  | SymbolInformation[]
  | null;
export type WorkspaceSymbolResult = SymbolInformation[] | null;
export type CompletionResult = CompletionItem[] | CompletionList | null;
export type SignatureHelpResult = SignatureHelp | null;
export type CodeActionResult = (Command | CodeAction)[] | null;
export type FormattingResult = TextEdit[] | null;

// Hover contents types
export type HoverContents =
  | string
  | MarkedString
  | MarkupContent
  | (string | MarkedString | MarkupContent)[];

export interface LSPClientState {
  process: ChildProcess | null;
  messageId: number;
  responseHandlers: Map<number | string, (response: LSPResponse) => void>;
  buffer: string;
  contentLength: number;
  diagnostics: Map<string, Diagnostic[]>;
  eventEmitter: EventEmitter;
  rootPath: string;
  languageId: string;
  serverCapabilities?: ServerCapabilities;
}

export interface LSPClientConfig {
  rootPath: string;
  process: ChildProcess;
  languageId?: string; // Default: "typescript"
  clientName?: string; // Default: "lsp-client"
  clientVersion?: string; // Default: "0.1.0"
  initializationOptions?: unknown; // Language-specific initialization options
}

export type LSPClient = {
  languageId: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  openDocument: (uri: string, text: string, languageId?: string) => void;
  closeDocument: (uri: string) => void;
  updateDocument: (uri: string, text: string, version: number) => void;
  isDocumentOpen: (uri: string) => boolean;
  findReferences: (uri: string, position: Position) => Promise<Location[]>;
  getDefinition: (
    uri: string,
    position: Position,
  ) => Promise<Location | Location[] | LocationLink[]>;
  getHover: (uri: string, position: Position) => Promise<HoverResult>;
  getDiagnostics: (uri: string) => Diagnostic[];
  pullDiagnostics?: (uri: string) => Promise<Diagnostic[]>;
  getDocumentSymbols: (
    uri: string,
  ) => Promise<DocumentSymbol[] | SymbolInformation[]>;
  getWorkspaceSymbols: (query: string) => Promise<SymbolInformation[]>;
  getCompletion: (uri: string, position: Position) => Promise<CompletionItem[]>;
  resolveCompletionItem: (item: CompletionItem) => Promise<CompletionItem>;
  getSignatureHelp: (
    uri: string,
    position: Position,
  ) => Promise<SignatureHelp | null>;
  getCodeActions: (
    uri: string,
    range: Range,
    context?: { diagnostics?: Diagnostic[] },
  ) => Promise<(Command | CodeAction)[]>;
  formatDocument: (
    uri: string,
    options: FormattingOptions,
  ) => Promise<TextEdit[]>;
  formatRange: (
    uri: string,
    range: Range,
    options: FormattingOptions,
  ) => Promise<TextEdit[]>;
  prepareRename: (uri: string, position: Position) => Promise<Range | null>;
  rename: (
    uri: string,
    position: Position,
    newName: string,
  ) => Promise<WorkspaceEdit | null>;
  applyEdit: (
    edit: WorkspaceEdit,
    label?: string,
  ) => Promise<ApplyWorkspaceEditResponse>;
  sendRequest: <T = unknown>(
    method: string,
    params?: Record<string, unknown>,
  ) => Promise<T>;
  on(
    event: "diagnostics",
    listener: (params: PublishDiagnosticsParams) => void,
  ): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  emit(event: "diagnostics", params: PublishDiagnosticsParams): boolean;
  emit(event: string, ...args: unknown[]): boolean;
  waitForDiagnostics: (
    fileUri: string,
    timeout?: number,
  ) => Promise<Diagnostic[]>;
  getDiagnosticSupport: () => {
    pushDiagnostics: boolean;
    pullDiagnostics: boolean;
  };
  getServerCapabilities: () => ServerCapabilities | undefined;
};
