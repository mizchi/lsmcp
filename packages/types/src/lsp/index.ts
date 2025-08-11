// Re-export all LSP types
export * from "./client.ts";
export * from "./protocol.ts";
export * from "./symbols.ts";
export * from "./diagnostics.ts";
export * from "./builders.ts";

// Re-export commonly used types from vscode-languageserver-types
export {
  Diagnostic,
  DiagnosticSeverity,
  Range,
  Position,
  Location,
  LocationLink,
  integer,
  DocumentSymbol,
  SymbolKind,
  SymbolInformation,
  SymbolTag,
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  TextEdit,
  WorkspaceEdit,
  DocumentUri,
  Hover,
  MarkupContent,
  MarkedString,
  SignatureInformation,
  ParameterInformation,
  CodeAction,
  CodeActionKind,
  Command,
  FormattingOptions,
  Color,
  ColorInformation,
  ColorPresentation,
  FoldingRange,
  FoldingRangeKind,
  SelectionRange,
  InlayHint,
  InlayHintKind,
  InlayHintLabelPart,
  SemanticTokens,
  DocumentHighlight,
  DocumentHighlightKind,
  DocumentLink,
} from "vscode-languageserver-types";

// Type aliases that are not exported at runtime from vscode-languageserver-types
export type Definition = Location | Location[];
export type SignatureHelp = {
  signatures: SignatureInformation[];
  activeSignature?: number;
  activeParameter?: number;
};
export type CallHierarchyItem = any; // These types are not available in v3.17.5
export type CallHierarchyIncomingCall = any;
export type CallHierarchyOutgoingCall = any;
export type TypeHierarchyItem = any;
export type TypeHierarchySupertypeParams = any;
export type TypeHierarchySubtypeParams = any;
export type SemanticTokensEdit = any;
