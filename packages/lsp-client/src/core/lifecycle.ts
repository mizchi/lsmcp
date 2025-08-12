/**
 * LSP Client lifecycle management
 */

import type {
  InitializeParams,
  InitializeResult,
  ServerCapabilities,
} from "../protocol/types/index.ts";
import type { LSPClientState, LSPClientConfig } from "./state.ts";
import type { ConnectionHandler } from "./connection.ts";
import { debug, formatError } from "../utils/debug.ts";
import { getServerCharacteristics } from "../utils/helpers.ts";

export class LifecycleManager {
  constructor(
    private state: LSPClientState,
    private connection: ConnectionHandler,
    private config: LSPClientConfig,
  ) {}

  async initialize(): Promise<void> {
    const initParams = this.buildInitializeParams();

    debug(
      "[lspClient] Sending initialize request:",
      JSON.stringify(initParams, null, 2),
    );

    const initResult = await this.connection.sendRequest<InitializeResult>(
      "initialize",
      initParams,
    );

    // Store server capabilities
    this.state.serverCapabilities = initResult.capabilities;

    // Send initialized notification
    this.connection.sendNotification("initialized", {});

    // Wait for server to be ready
    await this.waitForServerReady();
  }

  private buildInitializeParams(): InitializeParams {
    return {
      processId: process.pid,
      clientInfo: {
        name: this.config.clientName || "lsp-client",
        version: this.config.clientVersion || "0.1.0",
      },
      locale: "en",
      rootPath: this.state.rootPath,
      rootUri: `file://${this.state.rootPath}`,
      workspaceFolders: [
        {
          uri: `file://${this.state.rootPath}`,
          name: this.state.rootPath.split("/").pop() || "workspace",
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
      initializationOptions: this.config.initializationOptions,
    };
  }

  private async waitForServerReady(): Promise<void> {
    const characteristics = getServerCharacteristics(
      this.state.languageId,
      this.state.serverCharacteristics,
    );

    // Simply wait for the server to be ready based on its characteristics
    await new Promise((resolve) =>
      setTimeout(resolve, characteristics.readinessCheckTimeout),
    );
  }

  async start(): Promise<void> {
    if (!this.state.process) {
      throw new Error("No process provided to LSP client");
    }

    let stderrBuffer = "";

    this.state.process.stdout?.on("data", (data: Buffer) => {
      this.state.buffer += data.toString();
      this.connection.processBuffer();
    });

    this.state.process.stderr?.on("data", (data: Buffer) => {
      stderrBuffer += data.toString();
    });

    this.state.process.on("exit", (code) => {
      this.state.process = null;

      if (code !== 0 && code !== null) {
        const context = {
          operation: "LSP server process",
          language: this.state.languageId,
          details: { exitCode: code, stderr: stderrBuffer },
        };
        const error = new Error(
          `LSP server exited unexpectedly with code ${code}`,
        );
        debug(formatError(error, context));
      }
    });

    this.state.process.on("error", (error) => {
      const context = {
        operation: "LSP server startup",
        language: this.state.languageId,
      };
      debug(formatError(error, context));
    });

    // Initialize the LSP connection
    try {
      await this.initialize();
    } catch (error) {
      const context = {
        operation: "LSP initialization",
        language: this.state.languageId,
      };
      throw new Error(formatError(error, context));
    }
  }

  async stop(): Promise<void> {
    if (this.state.process) {
      // Send shutdown request
      try {
        await this.connection.sendRequest("shutdown");
        this.connection.sendNotification("exit");
      } catch {
        // Ignore errors during shutdown
      }

      // Give it a moment to shut down gracefully
      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        if (!this.state.process.killed) {
          this.state.process.kill();
        }
      } catch {
        // Ignore errors during process termination
      }
      this.state.process = null;
    }
  }

  getServerCapabilities(): ServerCapabilities | undefined {
    return this.state.serverCapabilities;
  }
}
