// LSP Adapter configuration types

export interface LspAdapter {
  id: string;
  name: string;
  bin: string;
  args?: string[];
  command?: string[];
  baseLanguage: string;
  languages?: string[];
  extensions?: string[];
  initializationOptions?: any;
  serverCharacteristics?: ServerCharacteristics;
  doctor?: () => Promise<DoctorResult>;
  capabilities?: AdapterCapabilities;
}

export interface ServerCharacteristics {
  documentOpenDelay?: number;
  operationTimeout?: number;
  supportsWorkspaceSymbols?: boolean;
  supportsPullDiagnostics?: boolean;
  supportsPushDiagnostics?: boolean;
  supportsCompletion?: boolean;
  supportsHover?: boolean;
  supportsDefinition?: boolean;
  supportsReferences?: boolean;
  supportsDocumentSymbol?: boolean;
  supportsCodeAction?: boolean;
  supportsRename?: boolean;
  supportsFormatting?: boolean;
  supportsSignatureHelp?: boolean;
}

export interface AdapterCapabilities {
  textDocument?: {
    completion?: boolean;
    hover?: boolean;
    signatureHelp?: boolean;
    definition?: boolean;
    references?: boolean;
    documentHighlight?: boolean;
    documentSymbol?: boolean;
    codeAction?: boolean;
    codeLens?: boolean;
    formatting?: boolean;
    rangeFormatting?: boolean;
    onTypeFormatting?: boolean;
    rename?: boolean;
    publishDiagnostics?: boolean;
    foldingRange?: boolean;
    selectionRange?: boolean;
    linkedEditingRange?: boolean;
    callHierarchy?: boolean;
    semanticTokens?: boolean;
    moniker?: boolean;
  };
  workspace?: {
    applyEdit?: boolean;
    workspaceEdit?: boolean;
    didChangeConfiguration?: boolean;
    didChangeWatchedFiles?: boolean;
    symbol?: boolean;
    executeCommand?: boolean;
    workspaceFolders?: boolean;
    configuration?: boolean;
    semanticTokens?: boolean;
    codeLens?: boolean;
    fileOperations?: boolean;
  };
}

export interface DoctorResult {
  ok: boolean;
  message?: string;
  details?: {
    binary?: string;
    version?: string;
    path?: string;
    error?: string;
  };
}

export interface AdapterRegistry {
  register(adapter: LspAdapter): void;
  get(id: string): LspAdapter | undefined;
  getByLanguage(language: string): LspAdapter | undefined;
  getByExtension(extension: string): LspAdapter | undefined;
  list(): LspAdapter[];
  has(id: string): boolean;
}
