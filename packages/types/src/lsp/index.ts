// Re-export all LSP types
// Export from client.ts first (has the main implementations)
export * from "./client.ts";
// Only export non-duplicate items from protocol.ts
export { LSPMethods, type LSPMethod } from "./protocol.ts";
export * from "./symbols.ts";
export * from "./diagnostics.ts";

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
import type { SignatureInformation as SignatureInfo } from "vscode-languageserver-types";
export type SignatureHelp = {
  signatures: SignatureInfo[];
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
