/**
 * Common types and interfaces for LSP commands
 */

import type {
  CodeAction,
  Command,
  CompletionItem,
  Diagnostic,
  DocumentSymbol,
  FormattingOptions,
  Location,
  LocationLink,
  MarkupContent,
  Position,
  Range,
  SignatureHelp,
  SymbolInformation,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver-types";

/**
 * Base interface for all LSP commands
 */
export interface LSPCommand<TParams, TResult> {
  /**
   * The LSP method name (e.g., "textDocument/definition")
   */
  method: string;

  /**
   * Build request parameters from input
   */
  buildParams(input: TParams): unknown;

  /**
   * Process the raw response from the LSP server
   */
  processResponse(response: unknown): TResult;
}

/**
 * Interface for sending LSP requests
 */
export interface LSPRequestSender {
  sendRequest<T>(method: string, params: unknown): Promise<T>;
}

/**
 * Common parameter types
 */
export interface TextDocumentPositionParams {
  uri: string;
  position: Position;
}

export interface TextDocumentParams {
  uri: string;
}

export interface ReferenceParams extends TextDocumentPositionParams {
  includeDeclaration?: boolean;
}

export interface CompletionParams extends TextDocumentPositionParams {
  // Additional completion context can be added here
}

export interface CodeActionParams {
  uri: string;
  range: Range;
  diagnostics?: Diagnostic[];
}

export interface FormattingParams {
  uri: string;
  options: FormattingOptions;
}

export interface RangeFormattingParams extends FormattingParams {
  range: Range;
}

export interface RenameParams extends TextDocumentPositionParams {
  newName: string;
}

/**
 * Response type helpers
 */
export type DefinitionResult = Location | Location[] | LocationLink[] | null;
export type ReferencesResult = Location[] | null;
export type HoverResult = {
  contents: string | { value: string } | MarkupContent | MarkupContent[];
  range?: Range;
} | null;
export type CompletionResult =
  | CompletionItem[]
  | {
      items: CompletionItem[];
      isIncomplete?: boolean;
    }
  | null;
export type DocumentSymbolResult =
  | DocumentSymbol[]
  | SymbolInformation[]
  | null;
export type CodeActionResult = (Command | CodeAction)[] | null;
export type FormattingResult = TextEdit[] | null;
export type SignatureHelpResult = SignatureHelp | null;
export type RenameResult = WorkspaceEdit | null;

/**
 * Utility function to convert LocationLink to Location
 */
export function locationLinkToLocation(link: LocationLink): Location {
  return {
    uri: link.targetUri,
    range: link.targetSelectionRange || link.targetRange,
  };
}

/**
 * Type guards
 */
export function isLocationLink(obj: unknown): obj is LocationLink {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "targetUri" in obj &&
    "targetRange" in obj
  );
}

export function isLocationLinkArray(obj: unknown): obj is LocationLink[] {
  return Array.isArray(obj) && obj.length > 0 && isLocationLink(obj[0]);
}

export function isCompletionList(
  obj: unknown,
): obj is { items: CompletionItem[]; isIncomplete?: boolean } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "items" in obj &&
    Array.isArray((obj as any).items)
  );
}
