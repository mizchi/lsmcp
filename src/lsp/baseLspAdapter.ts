import { ChildProcess, spawn } from "child_process";
import { LSPValidationResult, LSPValidator } from "./lspValidator.ts";
import { LspAdapter } from "../types.ts";
import { debugLog } from "../mcp/utils/errorHandler.ts";

export interface AdapterValidationOptions {
  testFileContent?: string;
  testFileName?: string;
  timeout?: number;
  skipFeatureTests?: boolean;
}

export interface AdapterHealth {
  isHealthy: boolean;
  validationResult: LSPValidationResult;
  lastChecked: Date;
}

export abstract class BaseLspAdapter {
  protected config: LspAdapter;
  private healthCache: AdapterHealth | null = null;
  private healthCacheTimeout = 60000; // 1 minute

  constructor(config: LspAdapter) {
    this.config = config;
  }

  /**
   * Get the adapter configuration
   */
  getConfig(): LspAdapter {
    return { ...this.config };
  }

  /**
   * Check if the LSP server binary is available
   */
  async checkAvailability(): Promise<{ available: boolean; message?: string }> {
    try {
      if (this.config.doctor) {
        const result = await this.config.doctor();
        return { available: result.ok, message: result.message };
      }

      // Default availability check - try to run the binary with --help
      const process = spawn(this.config.bin, ["--help"], {
        stdio: "pipe",
        timeout: 5000,
      });

      return new Promise((resolve) => {
        let timeout: NodeJS.Timeout | undefined;

        const cleanup = () => {
          if (timeout) clearTimeout(timeout);
          if (!process.killed) {
            process.kill();
          }
        };

        timeout = setTimeout(() => {
          cleanup();
          resolve({ available: false, message: "Binary check timeout" });
        }, 5000);

        process.on("exit", (code) => {
          cleanup();
          resolve({
            available: code === 0 || code === 1, // Help might return 1
            message:
              code === 0 ? "Binary available" : `Binary exit code: ${code}`,
          });
        });

        process.on("error", (error: Error) => {
          cleanup();
          resolve({
            available: false,
            message: `Binary not found: ${error.message}`,
          });
        });
      });
    } catch (error) {
      return {
        available: false,
        message: `Availability check failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Start the LSP server process
   */
  async startProcess(rootPath: string): Promise<ChildProcess> {
    debugLog(
      `Starting LSP server: ${this.config.bin} ${
        this.config.args?.join(" ") || ""
      }`,
    );

    try {
      const lspProcess = spawn(this.config.bin, this.config.args || [], {
        cwd: rootPath,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ...this.getEnvironmentVariables() },
      });

      // Give the process a moment to start
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (lspProcess.exitCode !== null) {
            reject(
              new Error(
                `LSP server exited immediately with code ${lspProcess.exitCode}`,
              ),
            );
          } else {
            resolve(void 0);
          }
        }, 1000);

        lspProcess.on("spawn", () => {
          clearTimeout(timeout);
          resolve(void 0);
        });

        lspProcess.on("error", (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      return lspProcess;
    } catch (error) {
      throw new Error(
        `Failed to start LSP server: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Validate the LSP server functionality
   */
  async validateLSP(
    rootPath: string,
    options: AdapterValidationOptions = {},
  ): Promise<LSPValidationResult> {
    // Check cache first
    if (
      this.healthCache &&
      Date.now() - this.healthCache.lastChecked.getTime() <
        this.healthCacheTimeout
    ) {
      debugLog("Using cached health check result");
      return this.healthCache.validationResult;
    }

    let process: ChildProcess | null = null;

    try {
      // Start the process
      process = await this.startProcess(rootPath);

      // Create validator
      const validator = new LSPValidator({
        rootPath,
        process,
        languageId: this.config.baseLanguage,
        initializationOptions: this.config.initializationOptions,
        testFileContent:
          options.testFileContent || this.getDefaultTestContent(),
        testFileName: options.testFileName || this.getDefaultTestFileName(),
        timeout: options.timeout || 10000,
      });

      // Run validation
      const result = await validator.validateFull();

      // Cache the result
      this.healthCache = {
        isHealthy: result.overallHealth === "healthy",
        validationResult: result,
        lastChecked: new Date(),
      };

      return result;
    } catch (error) {
      const errorResult: LSPValidationResult = {
        connectionSuccess: false,
        initializationSuccess: false,
        capabilities: {},
        featureTests: [],
        overallHealth: "unhealthy",
        summary: `Validation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };

      return errorResult;
    } finally {
      if (process && !process.killed) {
        try {
          process.kill();
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Get the current health status (uses cache if available)
   */
  async getHealth(rootPath: string): Promise<AdapterHealth> {
    if (
      this.healthCache &&
      Date.now() - this.healthCache.lastChecked.getTime() <
        this.healthCacheTimeout
    ) {
      return this.healthCache;
    }

    const validationResult = await this.validateLSP(rootPath);

    return {
      isHealthy: validationResult.overallHealth === "healthy",
      validationResult,
      lastChecked: new Date(),
    };
  }

  /**
   * Clear the health cache (force re-validation on next check)
   */
  clearHealthCache(): void {
    this.healthCache = null;
  }

  /**
   * Get environment variables for the LSP server process
   * Override this in subclasses to provide language-specific environment setup
   */
  protected getEnvironmentVariables(): Record<string, string> {
    return {};
  }

  /**
   * Get default test content for validation
   * Override this in subclasses to provide language-specific test content
   */
  protected getDefaultTestContent(): string {
    return `# Test file for ${this.config.baseLanguage}\n`;
  }

  /**
   * Get default test file name for validation
   * Override this in subclasses to provide language-specific file extensions
   */
  protected getDefaultTestFileName(): string {
    const extensions: Record<string, string> = {
      python: "test.py",
      typescript: "test.ts",
      javascript: "test.js",
      rust: "test.rs",
      go: "test.go",
      fsharp: "test.fs",
    };

    return extensions[this.config.baseLanguage] || "test.txt";
  }

  /**
   * Get information about supported LSP features
   */
  getSupportedFeatures(): string[] {
    const allFeatures = [
      "textDocument/hover",
      "textDocument/completion",
      "textDocument/definition",
      "textDocument/references",
      "textDocument/documentSymbol",
      "textDocument/formatting",
      "textDocument/rename",
      "textDocument/codeAction",
      "textDocument/signatureHelp",
      "textDocument/diagnostic",
    ];

    const unsupported = this.config.unsupported || [];
    return allFeatures.filter((feature) => !unsupported.includes(feature));
  }

  /**
   * Get information about unsupported LSP features
   */
  getUnsupportedFeatures(): string[] {
    return this.config.unsupported || [];
  }

  /**
   * Get diagnostic information about the adapter
   */
  async getDiagnosticInfo(rootPath: string): Promise<{
    adapter: string;
    available: boolean;
    health: AdapterHealth;
    supportedFeatures: string[];
    unsupportedFeatures: string[];
    availabilityMessage?: string;
  }> {
    const [availability, health] = await Promise.all([
      this.checkAvailability(),
      this.getHealth(rootPath),
    ]);

    return {
      adapter: this.config.id,
      available: availability.available,
      health,
      supportedFeatures: this.getSupportedFeatures(),
      unsupportedFeatures: this.getUnsupportedFeatures(),
      availabilityMessage: availability.message,
    };
  }
}
