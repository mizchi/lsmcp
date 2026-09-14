/**
 * LSP Client lifecycle management
 */

import type {
  InitializeParams,
  InitializeResult,
  ServerCapabilities,
} from "../protocol/types/index.ts";
import type { LSPProcessState, LSPClientConfig } from "./state.ts";
import type { ConnectionHandler } from "./connection.ts";
import { debug, formatError } from "../utils/debug.ts";
import { getServerCharacteristics } from "../utils/helpers.ts";

export class LifecycleManager {
  constructor(
    private state: LSPProcessState,
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
          applyEdit: true,
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
    const proc = this.state.process;

    let stderrBuffer = "";

    const processExitPromise = new Promise<never>((_, reject) => {
      const fail = (error: Error) => {
        this.state.process = null;
        this.connection.rejectPendingRequests(error);
        reject(error);
      };

      proc.once("exit", (code, signal) => {
        const stderr = stderrBuffer.trim();
        const errorDetails = stderr ? `\nStderr output:\n${stderr}` : "";
        const cause = code !== null ? `code ${code}` : `signal ${signal}`;
        fail(
          new Error(
            `LSP server exited (${cause}) before answering initialize${errorDetails}`,
          ),
        );
      });

      proc.once("error", (error) => {
        fail(new Error(`LSP server process error: ${error.message}`));
      });
    });

    proc.stdout?.on("data", (data: Buffer) => {
      this.connection.receive(data);
    });

    proc.stderr?.on("data", (data: Buffer) => {
      stderrBuffer += data.toString();
      // Log stderr in real-time for debugging
      const lines = data
        .toString()
        .split("\n")
        .filter((line) => line.trim());
      for (const line of lines) {
        debug(`[LSP stderr] ${line}`);
      }
    });

    try {
      await Promise.race([this.initialize(), processExitPromise]);

      proc.removeAllListeners("exit");
      proc.removeAllListeners("error");

      proc.on("exit", (code, signal) => {
        this.state.process = null;
        const cause = code !== null ? `code ${code}` : `signal ${signal}`;
        if (code !== 0 && code !== null) {
          debug(`[LSP] Server exited with code ${code}`);
        }
        this.connection.rejectPendingRequests(
          new Error(`LSP server exited (${cause})`),
        );
      });

      proc.on("error", (error) => {
        debug(`[LSP] Server error: ${error.message}`);
      });
    } catch (error) {
      const context = {
        operation: "LSP initialization",
        language: this.state.languageId,
        stderr: stderrBuffer.trim(),
      };

      // Kill the process if it's still running
      if (!proc.killed) {
        proc.kill();
      }

      throw new Error(
        error instanceof Error ? error.message : formatError(error, context),
      );
    }
  }

  async stop(): Promise<void> {
    const proc = this.state.process;
    if (proc) {
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
        if (!proc.killed) {
          proc.kill();
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
