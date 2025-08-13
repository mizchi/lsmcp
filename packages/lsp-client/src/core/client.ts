/**
 * Main LSP Client implementation
 */

import type {
  Position,
  Location,
  LocationLink,
  Hover,
  Diagnostic,
  DocumentSymbol,
  SymbolInformation,
  CompletionItem,
  SignatureHelp,
  CodeAction,
  Command,
  TextEdit,
  WorkspaceEdit,
  Range,
  FormattingOptions,
  PublishDiagnosticsParams,
  ServerCapabilities,
} from "../protocol/types/index.ts";
import type { LSPClientConfig } from "./state.ts";
import { createInitialState } from "./state.ts";
import { ConnectionHandler } from "./connection.ts";
import { LifecycleManager } from "./lifecycle.ts";
import { DocumentManager } from "../managers/document-manager.ts";
import { DiagnosticsManager } from "../managers/diagnostics.ts";
import { createFeatureCommands } from "../utils/features.ts";
import { applyWorkspaceEditManually } from "../managers/workspace.ts";
import { getLanguageIdFromPath } from "../utils/language.ts";
import { debug } from "../utils/debug.ts";
import type { IFileSystem } from "../interfaces.ts";

export interface LSPClient {
  languageId: string;
  rootPath: string;
  fileSystemApi: IFileSystem;

  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  isInitialized(): boolean;
  supportsFeature(feature: string): boolean;

  // Document management
  openDocument(uri: string, text: string, languageId?: string): void;
  closeDocument(uri: string): void;
  updateDocument(uri: string, text: string, version: number): void;
  isDocumentOpen(uri: string): boolean;

  // LSP features
  findReferences(uri: string, position: Position): Promise<Location[]>;
  getDefinition(
    uri: string,
    position: Position,
  ): Promise<Location | Location[] | LocationLink[]>;
  getHover(uri: string, position: Position): Promise<Hover | null>;
  getDiagnostics(uri: string): Diagnostic[];
  pullDiagnostics(uri: string): Promise<Diagnostic[]>;
  getDocumentSymbols(
    uri: string,
  ): Promise<DocumentSymbol[] | SymbolInformation[]>;
  getWorkspaceSymbols(query: string): Promise<SymbolInformation[]>;
  getCompletion(uri: string, position: Position): Promise<CompletionItem[]>;
  resolveCompletionItem(item: CompletionItem): Promise<CompletionItem>;
  getSignatureHelp(
    uri: string,
    position: Position,
  ): Promise<SignatureHelp | null>;
  getCodeActions(
    uri: string,
    range: Range,
    context?: { diagnostics?: Diagnostic[] },
  ): Promise<(Command | CodeAction)[]>;
  formatDocument(uri: string, options: FormattingOptions): Promise<TextEdit[]>;
  formatRange(
    uri: string,
    range: Range,
    options: FormattingOptions,
  ): Promise<TextEdit[]>;
  prepareRename(uri: string, position: Position): Promise<Range | null>;
  rename(
    uri: string,
    position: Position,
    newName: string,
  ): Promise<WorkspaceEdit | null>;
  applyEdit(
    edit: WorkspaceEdit,
    label?: string,
  ): Promise<{ applied: boolean; failureReason?: string }>;

  // Advanced features
  sendRequest<T = unknown>(method: string, params?: unknown): Promise<T>;
  on(
    event: "diagnostics",
    listener: (params: PublishDiagnosticsParams) => void,
  ): void;
  emit(event: string, ...args: unknown[]): boolean;
  waitForDiagnostics(fileUri: string, timeout?: number): Promise<Diagnostic[]>;
  getDiagnosticSupport(): {
    pushDiagnostics: boolean;
    pullDiagnostics: boolean;
  };
  getServerCapabilities(): ServerCapabilities | undefined;
  supportsFeature(feature: string): boolean;
}

export function createLSPClient(config: LSPClientConfig): LSPClient {
  const state = createInitialState(config);
  const connection = new ConnectionHandler(state);
  const lifecycle = new LifecycleManager(state, connection, config);
  const documentManager = new DocumentManager();
  const diagnosticsManager = new DiagnosticsManager(state.eventEmitter);
  const commands = createFeatureCommands();

  // Create the client interface
  const client: LSPClient = {
    languageId: state.languageId,
    rootPath: state.rootPath,
    fileSystemApi: state.fileSystemApi,

    // Lifecycle
    start: () => lifecycle.start(),
    stop: () => lifecycle.stop(),
    isInitialized: () => state.serverCapabilities !== undefined,
    supportsFeature: (feature: string) => {
      if (!state.serverCapabilities) return false;
      // Check common LSP capabilities
      const caps = state.serverCapabilities as any;
      switch (feature) {
        case 'hover': return !!caps.hoverProvider;
        case 'completion': return !!caps.completionProvider;
        case 'definition': return !!caps.definitionProvider;
        case 'references': return !!caps.referencesProvider;
        case 'rename': return !!caps.renameProvider;
        case 'documentSymbol': return !!caps.documentSymbolProvider;
        case 'workspaceSymbol': return !!caps.workspaceSymbolProvider;
        case 'codeAction': return !!caps.codeActionProvider;
        case 'formatting': return !!caps.documentFormattingProvider;
        case 'rangeFormatting': return !!caps.documentRangeFormattingProvider;
        case 'signatureHelp': return !!caps.signatureHelpProvider;
        case 'diagnostics': return true; // Usually always supported
        default: return false;
      }
    },

    // Document management
    openDocument(uri: string, text: string, languageId?: string): void {
      const actualLanguageId =
        languageId || getLanguageIdFromPath(uri) || state.languageId;
      documentManager.openDocument(
        uri,
        text,
        connection.sendNotification.bind(connection),
        actualLanguageId,
      );
    },

    closeDocument(uri: string): void {
      documentManager.closeDocument(
        uri,
        connection.sendNotification.bind(connection),
      );
      diagnosticsManager.clearDiagnostics(uri);
    },

    updateDocument(uri: string, text: string, version: number): void {
      documentManager.updateDocument(
        uri,
        text,
        connection.sendNotification.bind(connection),
        version,
      );
    },

    isDocumentOpen(uri: string): boolean {
      return documentManager.isDocumentOpen(uri);
    },

    // LSP features - delegated to feature modules
    async findReferences(uri: string, position: Position): Promise<Location[]> {
      const params = commands.references.buildParams({
        uri,
        position,
        includeDeclaration: true,
      });
      const result = await connection.sendRequest<Location[] | null>(
        commands.references.method,
        params,
      );
      return commands.references.processResponse(result);
    },

    async getDefinition(
      uri: string,
      position: Position,
    ): Promise<Location | Location[] | LocationLink[]> {
      const params = commands.definition.buildParams({ uri, position });
      debug(
        "[lspClient] Sending textDocument/definition request:",
        JSON.stringify(params, null, 2),
      );
      const result = await connection.sendRequest(
        commands.definition.method,
        params,
      );
      debug(
        "[lspClient] Received definition response:",
        JSON.stringify(result, null, 2),
      );
      return commands.definition.processResponse(result);
    },

    async getHover(uri: string, position: Position): Promise<Hover | null> {
      const params = commands.hover.buildParams({ uri, position });
      const result = await connection.sendRequest(
        commands.hover.method,
        params,
      );
      return commands.hover.processResponse(result);
    },

    getDiagnostics(uri: string): Diagnostic[] {
      return diagnosticsManager.getDiagnostics(uri);
    },

    async pullDiagnostics(uri: string): Promise<Diagnostic[]> {
      return diagnosticsManager.pullDiagnostics(
        uri,
        connection.sendRequest.bind(connection),
      );
    },

    async getDocumentSymbols(
      uri: string,
    ): Promise<DocumentSymbol[] | SymbolInformation[]> {
      try {
        const params = commands.documentSymbols.buildParams({ uri });
        const result = await connection.sendRequest(
          commands.documentSymbols.method,
          params,
        );
        return commands.documentSymbols.processResponse(result);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("Unhandled method") ||
          errorMessage.includes("Method not found")
        ) {
          debug("LSP server doesn't support document symbols");
          throw new Error(
            "Document symbols not supported by this language server",
          );
        }
        throw error;
      }
    },

    async getWorkspaceSymbols(query: string): Promise<SymbolInformation[]> {
      const params = { query };
      const result = await connection.sendRequest<SymbolInformation[] | null>(
        "workspace/symbol",
        params,
      );
      return result ?? [];
    },

    async getCompletion(
      uri: string,
      position: Position,
    ): Promise<CompletionItem[]> {
      const params = commands.completion.buildParams({ uri, position });
      const result = await connection.sendRequest(
        commands.completion.method,
        params,
      );
      return commands.completion.processResponse(result);
    },

    async resolveCompletionItem(item: CompletionItem): Promise<CompletionItem> {
      const params = commands.completionResolve.buildParams(item);
      const result = await connection.sendRequest<CompletionItem>(
        commands.completionResolve.method,
        params,
      );
      return commands.completionResolve.processResponse(result) || item;
    },

    async getSignatureHelp(
      uri: string,
      position: Position,
    ): Promise<SignatureHelp | null> {
      const params = commands.signatureHelp.buildParams({ uri, position });
      const result = await connection.sendRequest(
        commands.signatureHelp.method,
        params,
      );
      return commands.signatureHelp.processResponse(result);
    },

    async getCodeActions(
      uri: string,
      range: Range,
      context?: { diagnostics?: Diagnostic[] },
    ): Promise<(Command | CodeAction)[]> {
      const params = commands.codeAction.buildParams({
        uri,
        range,
        diagnostics: context?.diagnostics,
      });
      const result = await connection.sendRequest(
        commands.codeAction.method,
        params,
      );
      return commands.codeAction.processResponse(result);
    },

    async formatDocument(
      uri: string,
      options: FormattingOptions,
    ): Promise<TextEdit[]> {
      const params = commands.formatting.buildParams({ uri, options });
      const result = await connection.sendRequest(
        commands.formatting.method,
        params,
      );
      return commands.formatting.processResponse(result);
    },

    async formatRange(
      uri: string,
      range: Range,
      options: FormattingOptions,
    ): Promise<TextEdit[]> {
      const params = commands.rangeFormatting.buildParams({
        uri,
        range,
        options,
      });
      const result = await connection.sendRequest(
        commands.rangeFormatting.method,
        params,
      );
      return commands.rangeFormatting.processResponse(result);
    },

    async prepareRename(
      uri: string,
      position: Position,
    ): Promise<Range | null> {
      const params = commands.prepareRename.buildParams({ uri, position });
      try {
        const result = await connection.sendRequest(
          commands.prepareRename.method,
          params,
        );
        return commands.prepareRename.processResponse(result);
      } catch {
        return null;
      }
    },

    async rename(
      uri: string,
      position: Position,
      newName: string,
    ): Promise<WorkspaceEdit | null> {
      const params = commands.rename.buildParams({ uri, position, newName });
      try {
        const result = await connection.sendRequest(
          commands.rename.method,
          params,
        );
        return commands.rename.processResponse(result);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("Unhandled method") ||
          errorMessage.includes("Method not found")
        ) {
          debug("LSP server doesn't support rename");
          return null;
        }
        throw error;
      }
    },

    async applyEdit(
      edit: WorkspaceEdit,
      label?: string,
    ): Promise<{ applied: boolean; failureReason?: string }> {
      try {
        const params = { edit, label };
        const result = await connection.sendRequest<{
          applied: boolean;
          failureReason?: string;
        }>("workspace/applyEdit", params);
        return (
          result ?? { applied: false, failureReason: "No response from server" }
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("Unhandled method") ||
          errorMessage.includes("Method not found")
        ) {
          debug(
            "LSP server doesn't support workspace/applyEdit, applying edits manually",
          );
          try {
            await applyWorkspaceEditManually(edit, state.fileSystemApi);
            return { applied: true };
          } catch (err) {
            return {
              applied: false,
              failureReason: `Failed to apply edits manually: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        }
        throw error;
      }
    },

    // Advanced features
    sendRequest: connection.sendRequest.bind(connection),

    on(
      event: "diagnostics",
      listener: (params: PublishDiagnosticsParams) => void,
    ): void {
      state.eventEmitter.on(event, listener);
    },

    emit(event: string, ...args: unknown[]): boolean {
      return state.eventEmitter.emit(event, ...args);
    },

    waitForDiagnostics(
      fileUri: string,
      timeout: number = 2000,
    ): Promise<Diagnostic[]> {
      return diagnosticsManager.waitForDiagnostics(fileUri, timeout);
    },

    getDiagnosticSupport(): {
      pushDiagnostics: boolean;
      pullDiagnostics: boolean;
    } {
      return DiagnosticsManager.getDiagnosticSupport(state.serverCapabilities);
    },

    getServerCapabilities(): ServerCapabilities | undefined {
      return lifecycle.getServerCapabilities();
    },
  };

  return client;
}
