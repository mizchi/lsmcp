import { ChildProcess } from "child_process";
import { Position } from "vscode-languageserver-types";
import { LSPClient, LSPClientConfig } from "./lspTypes.ts";
import { createLSPClient } from "./lspClient.ts";
import { debugLog } from "../mcp/utils/errorHandler.ts";

export interface LSPCapabilities {
  textDocumentSync?: boolean;
  diagnostics?: boolean;
  hover?: boolean;
  completion?: boolean;
  definition?: boolean;
  references?: boolean;
  documentSymbol?: boolean;
  formatting?: boolean;
  rename?: boolean;
  codeAction?: boolean;
  signatureHelp?: boolean;
}

export interface FeatureTestResult {
  feature: string;
  supported: boolean;
  working: boolean;
  error?: string;
  responseTime?: number;
}

export interface LSPValidationResult {
  connectionSuccess: boolean;
  initializationSuccess: boolean;
  capabilities: LSPCapabilities;
  featureTests: FeatureTestResult[];
  overallHealth: "healthy" | "degraded" | "unhealthy";
  summary: string;
}

export interface LSPValidatorConfig {
  rootPath: string;
  process: ChildProcess;
  languageId?: string;
  initializationOptions?: unknown;
  testFileContent?: string;
  testFileName?: string;
  timeout?: number;
}

export class LSPValidator {
  private client: LSPClient | null = null;
  private config: LSPValidatorConfig;
  private testFileUri: string;

  constructor(config: LSPValidatorConfig) {
    this.config = config;
    this.testFileUri = `file://${config.rootPath}/${
      config.testFileName || "test.py"
    }`;
  }

  async validateFull(): Promise<LSPValidationResult> {
    const result: LSPValidationResult = {
      connectionSuccess: false,
      initializationSuccess: false,
      capabilities: {},
      featureTests: [],
      overallHealth: "unhealthy",
      summary: "",
    };

    try {
      // Step 1: Test Connection
      debugLog("LSP Validator: Testing connection...");
      result.connectionSuccess = await this.validateConnection();

      if (!result.connectionSuccess) {
        result.summary = "Failed to establish LSP connection";
        return result;
      }

      // Step 2: Test Initialization
      debugLog("LSP Validator: Testing initialization...");
      result.initializationSuccess = await this.validateInitialization();

      if (!result.initializationSuccess) {
        result.summary = "Failed to initialize LSP client";
        return result;
      }

      // Step 3: Validate Capabilities
      debugLog("LSP Validator: Validating capabilities...");
      result.capabilities = await this.validateCapabilities();

      // Step 4: Test Features
      debugLog("LSP Validator: Testing individual features...");
      result.featureTests = await this.validateFeatures();

      // Step 5: Determine Overall Health
      result.overallHealth = this.determineOverallHealth(result.featureTests);
      result.summary = this.generateSummary(result);

      return result;
    } catch (error) {
      debugLog("LSP Validator: Validation failed:", error);
      result.summary = `Validation failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
      return result;
    } finally {
      await this.cleanup();
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      if (!this.config.process) {
        debugLog("LSP Validator: No process provided");
        return false;
      }

      // Check if process is still running
      if (this.config.process.killed || this.config.process.exitCode !== null) {
        debugLog("LSP Validator: Process is not running");
        return false;
      }

      // Check if process has stdin/stdout
      if (!this.config.process.stdin || !this.config.process.stdout) {
        debugLog("LSP Validator: Process missing stdin/stdout");
        return false;
      }

      debugLog("LSP Validator: Connection test passed");
      return true;
    } catch (error) {
      debugLog("LSP Validator: Connection test failed:", error);
      return false;
    }
  }

  async validateInitialization(): Promise<boolean> {
    try {
      const clientConfig: LSPClientConfig = {
        rootPath: this.config.rootPath,
        process: this.config.process,
        languageId: this.config.languageId,
        initializationOptions: this.config.initializationOptions,
      };

      this.client = createLSPClient(clientConfig);

      // Set timeout for initialization
      const timeout = this.config.timeout || 10000;
      const initPromise = this.client.start();

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Initialization timeout")), timeout);
      });

      await Promise.race([initPromise, timeoutPromise]);

      debugLog("LSP Validator: Initialization successful");
      return true;
    } catch (error) {
      debugLog("LSP Validator: Initialization failed:", error);
      return false;
    }
  }

  async validateCapabilities(): Promise<LSPCapabilities> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    const capabilities: LSPCapabilities = {};

    try {
      // Test basic capabilities by attempting to use them
      // Note: This is a simplified approach - in reality we'd check the initialization response

      // Test document sync by opening a test document
      const testContent =
        this.config.testFileContent || "# Test content\nprint('hello')\n";
      this.client.openDocument(this.testFileUri, testContent);
      capabilities.textDocumentSync = true;
      debugLog("LSP Validator: textDocumentSync supported");

      // We'll test other capabilities in the feature tests
      capabilities.diagnostics = true;
      capabilities.hover = true;
      capabilities.completion = true;
      capabilities.definition = true;
      capabilities.references = true;
      capabilities.documentSymbol = true;
      capabilities.formatting = true;
      capabilities.rename = true;
      capabilities.codeAction = true;
      capabilities.signatureHelp = true;
    } catch (error) {
      debugLog("LSP Validator: Capabilities validation failed:", error);
    }

    return capabilities;
  }

  async validateFeatures(): Promise<FeatureTestResult[]> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    const results: FeatureTestResult[] = [];
    const testPosition: Position = { line: 1, character: 5 };

    // Test Diagnostics
    results.push(
      await this.testFeature("diagnostics", async () => {
        if (!this.client?.pullDiagnostics) return false;
        const diagnostics = await this.client.pullDiagnostics(this.testFileUri);
        return Array.isArray(diagnostics);
      }),
    );

    // Test Hover
    results.push(
      await this.testFeature("hover", async () => {
        if (!this.client) return false;
        const hover = await this.client.getHover(
          this.testFileUri,
          testPosition,
        );
        return hover !== null;
      }),
    );

    // Test Completion
    results.push(
      await this.testFeature("completion", async () => {
        if (!this.client) return false;
        const completion = await this.client.getCompletion(
          this.testFileUri,
          testPosition,
        );
        return Array.isArray(completion);
      }),
    );

    // Test Definition
    results.push(
      await this.testFeature("definition", async () => {
        const definition = await this.client!.getDefinition(
          this.testFileUri,
          testPosition,
        );
        return definition !== null;
      }),
    );

    // Test References
    results.push(
      await this.testFeature("references", async () => {
        const references = await this.client!.findReferences(
          this.testFileUri,
          testPosition,
        );
        return Array.isArray(references);
      }),
    );

    // Test Document Symbols
    results.push(
      await this.testFeature("documentSymbol", async () => {
        const symbols = await this.client!.getDocumentSymbols(this.testFileUri);
        return Array.isArray(symbols);
      }),
    );

    // Test Formatting
    results.push(
      await this.testFeature("formatting", async () => {
        const edits = await this.client!.formatDocument(this.testFileUri, {
          tabSize: 4,
          insertSpaces: true,
        });
        return Array.isArray(edits);
      }),
    );

    // Test Rename
    results.push(
      await this.testFeature("rename", async () => {
        const edit = await this.client!.rename(
          this.testFileUri,
          testPosition,
          "newName",
        );
        return edit !== null;
      }),
    );

    // Test Code Actions
    results.push(
      await this.testFeature("codeAction", async () => {
        const actions = await this.client!.getCodeActions(this.testFileUri, {
          start: testPosition,
          end: testPosition,
        });
        return Array.isArray(actions);
      }),
    );

    // Test Signature Help
    results.push(
      await this.testFeature("signatureHelp", async () => {
        const help = await this.client!.getSignatureHelp(
          this.testFileUri,
          testPosition,
        );
        return help !== null;
      }),
    );

    return results;
  }

  private async testFeature(
    featureName: string,
    testFn: () => Promise<boolean>,
  ): Promise<FeatureTestResult> {
    const result: FeatureTestResult = {
      feature: featureName,
      supported: false,
      working: false,
    };

    try {
      const startTime = Date.now();
      const success = await Promise.race([
        testFn(),
        new Promise<boolean>((_, reject) => {
          setTimeout(() => reject(new Error("Feature test timeout")), 5000);
        }),
      ]);

      result.responseTime = Date.now() - startTime;
      result.supported = true;
      result.working = success;

      debugLog(
        `LSP Validator: ${featureName} test - supported: ${result.supported}, working: ${result.working}, time: ${result.responseTime}ms`,
      );
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.supported =
        !result.error.includes("not supported") &&
        !result.error.includes("Unhandled method");
      result.working = false;

      debugLog(`LSP Validator: ${featureName} test failed:`, result.error);
    }

    return result;
  }

  private determineOverallHealth(
    featureTests: FeatureTestResult[],
  ): "healthy" | "degraded" | "unhealthy" {
    const workingFeatures = featureTests.filter((test) => test.working).length;
    const totalFeatures = featureTests.length;

    if (workingFeatures === 0) {
      return "unhealthy";
    } else if (workingFeatures < totalFeatures * 0.7) {
      return "degraded";
    } else {
      return "healthy";
    }
  }

  private generateSummary(result: LSPValidationResult): string {
    if (!result.connectionSuccess) {
      return "LSP connection failed";
    }
    if (!result.initializationSuccess) {
      return "LSP initialization failed";
    }

    const workingFeatures = result.featureTests.filter(
      (test) => test.working,
    ).length;
    const totalFeatures = result.featureTests.length;

    return `LSP validation complete: ${workingFeatures}/${totalFeatures} features working (${result.overallHealth})`;
  }

  private async cleanup(): Promise<void> {
    if (this.client) {
      try {
        if (this.client.isDocumentOpen(this.testFileUri)) {
          this.client.closeDocument(this.testFileUri);
        }
        await this.client.stop();
      } catch (error) {
        debugLog("LSP Validator: Cleanup error:", error);
      }
      this.client = null;
    }
  }
}
