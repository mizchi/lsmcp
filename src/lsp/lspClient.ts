import { EventEmitter } from "events";
import {
  getErrorMessage,
  isErrorWithCode,
  isObject,
} from "../core/pure/types.ts";
import {
  CodeAction,
  Command,
  CompletionItem,
  Diagnostic,
  DocumentSymbol,
  FormattingOptions,
  Location,
  LocationLink,
  Position,
  Range,
  SignatureHelp,
  SymbolInformation,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver-types";
import { ChildProcess } from "child_process";

// Import new modular components
import { DiagnosticsManager } from "./diagnostics/diagnosticsManager.ts";
import { DocumentManager } from "./documents/documentManager.ts";
import { RequestManager } from "./core/requestManager.ts";
import { applyWorkspaceEditManually } from "./workspace/workspaceEditHandler.ts";

import {
  createCodeActionCommand,
  createCompletionCommand,
  createCompletionResolveCommand,
  createDefinitionCommand,
  createDocumentFormattingCommand,
  createDocumentRangeFormattingCommand,
  createDocumentSymbolsCommand,
  createHoverCommand,
  createPrepareRenameCommand,
  createPullDiagnosticsCommand,
  createReferencesCommand,
  createRenameCommand,
  createSignatureHelpCommand,
} from "./commands/index.ts";

// Type guard for PublishDiagnosticsParams
function isPublishDiagnosticsParams(
  params: unknown,
): params is PublishDiagnosticsParams {
  return (
    isObject(params) &&
    typeof params.uri === "string" &&
    Array.isArray(params.diagnostics)
  );
}

import {
  ApplyWorkspaceEditParams,
  ApplyWorkspaceEditResponse,
  CodeActionResult,
  CompletionResult,
  DefinitionResult,
  DocumentSymbolResult,
  FormattingResult,
  HoverContents,
  HoverResult,
  InitializeParams,
  InitializeResult,
  isLSPNotification,
  isLSPRequest,
  isLSPResponse,
  LSPClient,
  LSPClientConfig,
  LSPClientState,
  LSPMessage,
  LSPResponse,
  PublishDiagnosticsParams,
  ReferencesResult,
  ServerCapabilities,
  SignatureHelpResult,
  WorkspaceSymbolResult,
} from "./lspTypes.ts";
import { debug } from "../mcp/utils/mcpHelpers.ts";
import { ErrorContext, formatError } from "../mcp/utils/errorHandler.ts";
import { getLanguageIdFromPath } from "../core/pure/languageDetection.ts";

// Re-export types for backward compatibility
export type {
  DefinitionResult,
  HoverContents,
  HoverResult,
  LSPClient,
  LSPClientConfig,
  ReferencesResult,
};

// Re-export getLanguageIdFromPath for backward compatibility
export { getLanguageIdFromPath };

// Global state for active client
let activeClient: LSPClient | null = null;

/**
 * Set the active LSP client (for testing purposes)
 * @param client The LSP client to set as active
 */
export function setActiveClient(client: LSPClient | null): void {
  activeClient = client;
}

/**
 * Get the active LSP client
 * @returns The active LSP client or undefined if not initialized
 */
export function getLSPClient(): LSPClient | undefined {
  return activeClient ?? undefined;
}

/**
 * Initialize a global LSP client with the given process
 * @param rootPath The root path of the project
 * @param process The LSP server process
 * @param languageId The language ID (default: "typescript")
 * @param initializationOptions Language-specific initialization options
 * @returns The initialized LSP client
 */
export async function initialize(
  rootPath: string,
  process: ChildProcess,
  languageId?: string,
  initializationOptions?: unknown,
): Promise<LSPClient> {
  // Stop existing client if any
  if (activeClient) {
    await activeClient.stop().catch(() => {});
  }

  // Create new client
  activeClient = createLSPClient({
    rootPath,
    process,
    languageId,
    initializationOptions,
  });

  // Start the client
  await activeClient.start();

  return activeClient;
}

/**
 * Get the active LSP client
 * @throws Error if no client is initialized
 * @returns The active LSP client
 */
export function getActiveClient(): LSPClient {
  if (!activeClient) {
    throw new Error("No active LSP client. Call initialize() first.");
  }
  return activeClient;
}

/**
 * Shutdown and clear the active LSP client
 */
export async function shutdown(): Promise<void> {
  if (activeClient) {
    await activeClient.stop().catch(() => {});
    activeClient = null;
  }
}
export function createLSPClient(config: LSPClientConfig): LSPClient {
  const state: LSPClientState = {
    process: config.process,
    messageId: 0,
    responseHandlers: new Map(),
    buffer: "",
    contentLength: -1,
    diagnostics: new Map(),
    eventEmitter: new EventEmitter(),
    rootPath: config.rootPath,
    languageId: config.languageId || "plaintext", // Use plaintext as fallback, actual language will be detected per file
  };

  // Initialize managers
  const diagnosticsManager = new DiagnosticsManager(state.eventEmitter);
  const documentManager = new DocumentManager();
  const requestManager = new RequestManager();

  // Initialize commands
  const commands = {
    definition: createDefinitionCommand(),
    references: createReferencesCommand(),
    hover: createHoverCommand(),
    completion: createCompletionCommand(),
    completionResolve: createCompletionResolveCommand(),
    documentSymbols: createDocumentSymbolsCommand(),
    pullDiagnostics: createPullDiagnosticsCommand(),
    formatting: createDocumentFormattingCommand(),
    rangeFormatting: createDocumentRangeFormattingCommand(),
    prepareRename: createPrepareRenameCommand(),
    rename: createRenameCommand(),
    codeAction: createCodeActionCommand(),
    signatureHelp: createSignatureHelpCommand(),
  };

  function processBuffer(): void {
    while (state.buffer.length > 0) {
      if (state.contentLength === -1) {
        // Look for Content-Length header
        const headerEnd = state.buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) {
          return;
        }

        const header = state.buffer.substring(0, headerEnd);
        const contentLengthMatch = header.match(/Content-Length: (\d+)/);
        if (!contentLengthMatch) {
          debug("Invalid LSP header:", header);
          state.buffer = state.buffer.substring(headerEnd + 4);
          continue;
        }

        state.contentLength = parseInt(contentLengthMatch[1], 10);
        state.buffer = state.buffer.substring(headerEnd + 4);
      }

      if (state.buffer.length < state.contentLength) {
        // Wait for more data
        return;
      }

      const messageBody = state.buffer.substring(0, state.contentLength);
      state.buffer = state.buffer.substring(state.contentLength);
      state.contentLength = -1;

      try {
        const message = JSON.parse(messageBody) as LSPMessage;
        handleMessage(message);
      } catch (error) {
        debug("Failed to parse LSP message:", messageBody, error);
      }
    }
  }

  function handleMessage(message: LSPMessage): void {
    if (isLSPResponse(message)) {
      // This is a response
      requestManager.handleResponse(message as LSPResponse);
    } else if (isLSPNotification(message) || isLSPRequest(message)) {
      // This is a notification or request from server
      if (
        message.method === "textDocument/publishDiagnostics" &&
        message.params
      ) {
        // Type guard for PublishDiagnosticsParams
        if (isPublishDiagnosticsParams(message.params)) {
          const params = message.params;
          // Filter out diagnostics with invalid ranges
          const validDiagnostics = params.diagnostics.filter(
            (d) => d && d.range,
          );
          diagnosticsManager.handlePublishDiagnostics({
            ...params,
            diagnostics: validDiagnostics,
          });
        }
      }

      // Handle workspace/configuration request from server
      if (
        isLSPRequest(message) &&
        message.method === "workspace/configuration" &&
        message.params
      ) {
        // Respond with configuration for Deno or other LSP servers
        const params = message.params as { items: Array<{ section?: string }> };
        const configurations = params.items.map((item) => {
          // Return Deno-specific configuration if requested
          if (item.section === "deno") {
            const config = {
              enable: true,
              lint: true,
              unstable: true,
            };
            return config;
          }
          // Return empty configuration for other sections
          return {};
        });

        sendResponse(message.id, configurations);
      }

      state.eventEmitter.emit("message", message);
    }
  }

  function sendResponse(id: number | string, result: unknown): void {
    const response: LSPResponse = {
      jsonrpc: "2.0",
      id,
      result,
    };
    sendMessage(response);
  }

  function sendMessage(message: LSPMessage): void {
    if (!state.process) {
      throw new Error("LSP server not started");
    }
    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
    state.process.stdin?.write(header + content);
  }

  function sendRequest<T = unknown>(
    method: string,
    params?: unknown,
  ): Promise<T> {
    return requestManager.sendRequest<T>(
      method,
      params,
      sendMessage as (message: unknown) => void,
      30000,
    );
  }

  function sendNotification(method: string, params?: unknown): void {
    requestManager.sendNotification(
      method,
      params,
      sendMessage as (message: unknown) => void,
    );
  }

  async function waitForServerReady(): Promise<void> {
    // Create a minimal test document to verify server readiness
    const testUri = `file://${state.rootPath}/__lsmcp_test__.ts`;
    const testContent =
      "// Test document for server readiness check\nconst x = 1;\n";

    try {
      // Open a test document with the appropriate language ID
      openDocument(testUri, testContent, state.languageId || "typescript");

      // Try to get diagnostics with a short timeout
      // This verifies the server is processing documents
      await diagnosticsManager.waitForDiagnostics(testUri, 500).catch(() => {
        // Ignore timeout - some servers don't send diagnostics for simple files
      });

      // Close the test document
      closeDocument(testUri);
    } catch (error) {
      // If this fails, the server might not be ready yet
      debug(`Server readiness check failed: ${error}`);
    }
  }

  async function initialize(): Promise<void> {
    const initParams: InitializeParams = {
      processId: process.pid,
      clientInfo: {
        name: config.clientName || "lsp-client",
        version: config.clientVersion || "0.1.0",
      },
      locale: "en",
      rootPath: state.rootPath,
      rootUri: `file://${state.rootPath}`,
      workspaceFolders: [
        {
          uri: `file://${state.rootPath}`,
          name: state.rootPath.split("/").pop() || "workspace",
        },
      ],
      capabilities: {
        textDocument: {
          synchronization: {
            dynamicRegistration: false,
            willSave: false,
            willSaveWaitUntil: false,
            didSave: true,
          },
          publishDiagnostics: {
            relatedInformation: true,
          },
          definition: {
            linkSupport: true,
          },
          references: {},
          hover: {
            contentFormat: ["markdown", "plaintext"],
          },
          completion: {
            completionItem: {
              snippetSupport: true,
            },
          },
          documentSymbol: {
            hierarchicalDocumentSymbolSupport: true,
          },
        },
        workspace: {
          workspaceFolders: true,
          configuration: true,
        },
      },
      // Add language-specific initialization options
      initializationOptions: config.initializationOptions as
        | Record<string, unknown>
        | undefined,
    };

    const initResult = await sendRequest<InitializeResult>(
      "initialize",
      initParams,
    );

    // Store server capabilities
    state.serverCapabilities = initResult.capabilities;

    // Send initialized notification
    sendNotification("initialized", {});

    // Wait for server to be ready by sending a test request
    await waitForServerReady();
  }

  async function start(): Promise<void> {
    if (!state.process) {
      throw new Error("No process provided to LSP client");
    }

    let stderrBuffer = "";

    state.process.stdout?.on("data", (data: Buffer) => {
      state.buffer += data.toString();
      processBuffer();
    });

    state.process.stderr?.on("data", (data: Buffer) => {
      stderrBuffer += data.toString();
    });

    state.process.on("exit", (code) => {
      state.process = null;

      if (code !== 0 && code !== null) {
        const context: ErrorContext = {
          operation: "LSP server process",
          language: state.languageId,
          details: { exitCode: code, stderr: stderrBuffer },
        };
        const error = new Error(
          `LSP server exited unexpectedly with code ${code}`,
        );
        debug(formatError(error, context));
      }
    });

    state.process.on("error", (error) => {
      const context: ErrorContext = {
        operation: "LSP server startup",
        language: state.languageId,
      };
      debug(formatError(error, context));
    });

    // Initialize the LSP connection with better error handling
    try {
      await initialize();
    } catch (error) {
      const context: ErrorContext = {
        operation: "LSP initialization",
        language: state.languageId,
      };
      throw new Error(formatError(error, context));
    }
  }

  function openDocument(uri: string, text: string, languageId?: string): void {
    // Use provided languageId, or detect from file path, or fall back to client's default
    const actualLanguageId =
      languageId || getLanguageIdFromPath(uri) || state.languageId;

    documentManager.openDocument(uri, text, sendNotification, actualLanguageId);
  }

  function closeDocument(uri: string): void {
    documentManager.closeDocument(uri, sendNotification);
    // Also clear diagnostics for this document
    diagnosticsManager.clearDiagnostics(uri);
  }

  function isDocumentOpen(uri: string): boolean {
    return documentManager.isDocumentOpen(uri);
  }

  function updateDocument(uri: string, text: string, version: number): void {
    documentManager.updateDocument(uri, text, sendNotification, version);
  }

  async function findReferences(
    uri: string,
    position: Position,
  ): Promise<Location[]> {
    const params = commands.references.buildParams({
      uri,
      position,
      includeDeclaration: true,
    });
    const result = await sendRequest<ReferencesResult>(
      commands.references.method,
      params,
    );
    return commands.references.processResponse(result);
  }

  async function getDefinition(
    uri: string,
    position: Position,
  ): Promise<Location | Location[] | LocationLink[]> {
    const params = commands.definition.buildParams({ uri, position });

    debug(
      "[lspClient] Sending textDocument/definition request:",
      JSON.stringify(params, null, 2),
    );

    const result = await sendRequest<DefinitionResult>(
      commands.definition.method,
      params,
    );

    debug(
      "[lspClient] Received definition response:",
      JSON.stringify(result, null, 2),
    );

    return commands.definition.processResponse(result);
  }

  async function getHover(
    uri: string,
    position: Position,
  ): Promise<HoverResult> {
    const params = commands.hover.buildParams({ uri, position });
    const result = await sendRequest<any>(commands.hover.method, params);
    // The command's processResponse returns its own HoverResult type
    // which is compatible with our HoverResult
    const processed = commands.hover.processResponse(result);
    return processed as HoverResult;
  }

  function getDiagnostics(uri: string): Diagnostic[] {
    return diagnosticsManager.getDiagnostics(uri);
  }

  async function pullDiagnostics(uri: string): Promise<Diagnostic[]> {
    return diagnosticsManager.pullDiagnostics(uri, sendRequest);
  }

  async function getDocumentSymbols(
    uri: string,
  ): Promise<DocumentSymbol[] | SymbolInformation[]> {
    try {
      const params = commands.documentSymbols.buildParams({ uri });
      const result = await sendRequest<DocumentSymbolResult>(
        commands.documentSymbols.method,
        params,
      );
      return commands.documentSymbols.processResponse(result);
    } catch (error: unknown) {
      // Check if this is a method not supported error
      if (
        getErrorMessage(error).includes("Unhandled method") ||
        getErrorMessage(error).includes("Method not found") ||
        getErrorMessage(error).includes("InvalidRequest") ||
        (isErrorWithCode(error) && error.code === -32601)
      ) {
        debug("LSP server doesn't support document symbols");
        throw new Error(
          "Document symbols not supported by this language server",
        );
      }
      throw error;
    }
  }

  async function getWorkspaceSymbols(
    query: string,
  ): Promise<SymbolInformation[]> {
    const params = { query };
    const result = await sendRequest<WorkspaceSymbolResult>(
      "workspace/symbol",
      params,
    );
    return result ?? [];
  }

  async function getCompletion(
    uri: string,
    position: Position,
  ): Promise<CompletionItem[]> {
    const params = commands.completion.buildParams({ uri, position });
    const result = await sendRequest<CompletionResult>(
      commands.completion.method,
      params,
    );
    return commands.completion.processResponse(result);
  }

  async function resolveCompletionItem(
    item: CompletionItem,
  ): Promise<CompletionItem> {
    const params = commands.completionResolve.buildParams(item);
    const result = await sendRequest<CompletionItem>(
      commands.completionResolve.method,
      params,
    );
    return commands.completionResolve.processResponse(result) || item;
  }

  async function getSignatureHelp(
    uri: string,
    position: Position,
  ): Promise<SignatureHelp | null> {
    const params = commands.signatureHelp.buildParams({ uri, position });
    const result = await sendRequest<SignatureHelpResult>(
      commands.signatureHelp.method,
      params,
    );
    return commands.signatureHelp.processResponse(result);
  }

  async function getCodeActions(
    uri: string,
    range: Range,
    context?: { diagnostics?: Diagnostic[] },
  ): Promise<(Command | CodeAction)[]> {
    const params = commands.codeAction.buildParams({
      uri,
      range,
      diagnostics: context?.diagnostics,
    });
    const result = await sendRequest<CodeActionResult>(
      commands.codeAction.method,
      params,
    );
    return commands.codeAction.processResponse(result);
  }

  async function formatDocument(
    uri: string,
    options: FormattingOptions,
  ): Promise<TextEdit[]> {
    const params = commands.formatting.buildParams({ uri, options });
    const result = await sendRequest<FormattingResult>(
      commands.formatting.method,
      params,
    );
    return commands.formatting.processResponse(result);
  }

  async function formatRange(
    uri: string,
    range: Range,
    options: FormattingOptions,
  ): Promise<TextEdit[]> {
    const params = commands.rangeFormatting.buildParams({
      uri,
      range,
      options,
    });
    const result = await sendRequest<FormattingResult>(
      commands.rangeFormatting.method,
      params,
    );
    return commands.rangeFormatting.processResponse(result);
  }

  async function prepareRename(
    uri: string,
    position: Position,
  ): Promise<Range | null> {
    const params = commands.prepareRename.buildParams({ uri, position });
    try {
      const result = await sendRequest<Range | { range: Range } | null>(
        commands.prepareRename.method,
        params,
      );
      return commands.prepareRename.processResponse(result);
    } catch {
      // Some LSP servers don't support prepareRename
      return null;
    }
  }

  async function rename(
    uri: string,
    position: Position,
    newName: string,
  ): Promise<WorkspaceEdit | null> {
    const params = commands.rename.buildParams({ uri, position, newName });
    try {
      const result = await sendRequest<WorkspaceEdit>(
        commands.rename.method,
        params,
      );
      return commands.rename.processResponse(result);
    } catch (error: unknown) {
      // Check if this is a TypeScript Native Preview LSP that doesn't support rename
      if (
        getErrorMessage(error).includes("Unhandled method") ||
        getErrorMessage(error).includes("Method not found") ||
        (isErrorWithCode(error) && error.code === -32601)
      ) {
        debug("LSP server doesn't support rename, will use fallback");
        return null;
      }
      throw error;
    }
  }

  async function applyEdit(
    edit: WorkspaceEdit,
    label?: string,
  ): Promise<ApplyWorkspaceEditResponse> {
    try {
      // First, try to use the LSP server's workspace/applyEdit if supported
      const params: ApplyWorkspaceEditParams = {
        edit,
        label,
      };
      const result = await sendRequest<ApplyWorkspaceEditResponse>(
        "workspace/applyEdit",
        params,
      );
      return (
        result ?? { applied: false, failureReason: "No response from server" }
      );
    } catch (error: unknown) {
      // If the server doesn't support workspace/applyEdit, apply the edits manually
      if (
        getErrorMessage(error).includes("Unhandled method") ||
        getErrorMessage(error).includes("Method not found") ||
        (isErrorWithCode(error) && error.code === -32601)
      ) {
        debug(
          "LSP server doesn't support workspace/applyEdit, applying edits manually",
        );

        try {
          await applyWorkspaceEditManually(edit);
          return { applied: true };
        } catch (err) {
          return {
            applied: false,
            failureReason: `Failed to apply edits manually: ${
              err instanceof Error ? err.message : String(err)
            }`,
          };
        }
      }

      // Re-throw other errors
      throw error;
    }
  }

  async function stop(): Promise<void> {
    if (state.process) {
      // Send shutdown request
      try {
        await sendRequest("shutdown");
        sendNotification("exit");
      } catch {
        // Ignore errors during shutdown
      }

      // Give it a moment to shut down gracefully
      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        if (!state.process.killed) {
          state.process.kill();
        }
      } catch {
        // Ignore errors during process termination
      }
      state.process = null;
    }
  }

  // Helper function to check diagnostic support
  function getDiagnosticSupport(): {
    pushDiagnostics: boolean;
    pullDiagnostics: boolean;
  } {
    return DiagnosticsManager.getDiagnosticSupport(state.serverCapabilities);
  }

  // Helper function to wait for diagnostics
  function waitForDiagnostics(
    fileUri: string,
    timeout: number = 2000,
  ): Promise<Diagnostic[]> {
    return diagnosticsManager.waitForDiagnostics(fileUri, timeout);
  }

  // Helper function to get server capabilities
  function getServerCapabilities(): ServerCapabilities | undefined {
    return state.serverCapabilities;
  }

  const lspClient: LSPClient = {
    languageId: state.languageId,
    start,
    stop,
    openDocument,
    closeDocument,
    updateDocument,
    isDocumentOpen,
    findReferences,
    getDefinition,
    getHover,
    getDiagnostics,
    pullDiagnostics,
    getDocumentSymbols,
    getWorkspaceSymbols,
    getCompletion,
    resolveCompletionItem,
    getSignatureHelp,
    getCodeActions,
    formatDocument,
    formatRange,
    prepareRename,
    rename,
    applyEdit,
    sendRequest,
    on: ((
      event: "diagnostics",
      listener: (params: PublishDiagnosticsParams) => void,
    ) => {
      state.eventEmitter.on(event, listener);
    }) as LSPClient["on"],
    emit: (event: string, ...args: unknown[]) =>
      state.eventEmitter.emit(event, ...args),
    waitForDiagnostics,
    getDiagnosticSupport,
    getServerCapabilities,
  };

  return lspClient;
}
