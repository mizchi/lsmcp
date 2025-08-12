/**
 * LSP Response types
 */

import {
  Definition,
  Location,
  LocationLink,
  Hover,
  DocumentSymbol,
  SymbolInformation,
  CompletionItem,
  CompletionList,
  SignatureHelp,
  CodeAction,
  Command,
  TextEdit,
  WorkspaceEdit,
} from "@lsmcp/types";

// Server capabilities
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

// Apply workspace edit response
export interface ApplyWorkspaceEditResponse {
  applied: boolean;
  failureReason?: string;
  failedChange?: number;
}

// Result type aliases
export type HoverResult = Hover | null;
export type DefinitionResult = Definition | LocationLink[] | null;
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
export type RenameResult = WorkspaceEdit | null;

// Type guard helpers
export function isLocationLink(obj: any): obj is LocationLink {
  return obj && typeof obj === "object" && "targetUri" in obj;
}

export function isLocationLinkArray(obj: any): obj is LocationLink[] {
  return Array.isArray(obj) && obj.length > 0 && isLocationLink(obj[0]);
}

export function isCompletionList(obj: any): obj is CompletionList {
  return (
    obj && typeof obj === "object" && "items" in obj && Array.isArray(obj.items)
  );
}

export function locationLinkToLocation(link: LocationLink): Location {
  return {
    uri: link.targetUri,
    range: link.targetRange,
  };
}
