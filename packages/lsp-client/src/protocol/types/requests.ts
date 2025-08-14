/**
 * LSP Request parameter types
 */

import {
  DocumentUri,
  Position,
  Range,
  FormattingOptions,
  integer,
  Diagnostic,
} from "@internal/types";

// Base types
export interface TextDocumentIdentifier {
  uri: DocumentUri;
}

export interface TextDocumentPositionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

export interface TextDocumentItem {
  uri: DocumentUri;
  languageId: string;
  version: integer;
  text: string;
}

export interface VersionedTextDocumentIdentifier
  extends TextDocumentIdentifier {
  version: integer;
}

// Reference params
export interface ReferenceContext {
  includeDeclaration: boolean;
}

export interface ReferenceParams extends TextDocumentPositionParams {
  context: ReferenceContext;
}

// Initialize params
export interface WorkspaceFolder {
  uri: DocumentUri;
  name: string;
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

// Document change params
export interface DidOpenTextDocumentParams {
  textDocument: TextDocumentItem;
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

// Code action params
export interface CodeActionContext {
  diagnostics: Diagnostic[];
  only?: string[];
}

export interface CodeActionParams {
  textDocument: TextDocumentIdentifier;
  range: Range;
  context: CodeActionContext;
}

// Formatting params
export interface DocumentFormattingParams {
  textDocument: TextDocumentIdentifier;
  options: FormattingOptions;
}

export interface DocumentRangeFormattingParams {
  textDocument: TextDocumentIdentifier;
  range: Range;
  options: FormattingOptions;
}

// Rename params
export interface RenameParams extends TextDocumentPositionParams {
  newName: string;
}

// Workspace edit params
export interface ApplyWorkspaceEditParams {
  label?: string;
  edit: import("@internal/types").WorkspaceEdit;
}
