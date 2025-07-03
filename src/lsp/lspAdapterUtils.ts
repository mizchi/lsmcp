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

interface AdapterState {
  healthCache: AdapterHealth | null;
  healthCacheTimeout: number;
}

// Create adapter state
function createAdapterState(): AdapterState {
  return {
    healthCache: null,
    healthCacheTimeout: 60000, // 1 minute
  };
}

// Check if the LSP server binary is available
export async function checkAdapterAvailability(
  config: LspAdapter,
): Promise<{ available: boolean; message?: string }> {
  try {
    if (config.doctor) {
      const result = await config.doctor();
      return { available: result.ok, message: result.message };
    }

    // Default availability check - try to run the binary with --help
    const process = spawn(config.bin, ["--help"], {
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

// Get environment variables for the LSP server process
export function getAdapterEnvironmentVariables(
  config: LspAdapter,
): Record<string, string> {
  // Language-specific environment variables
  const languageEnv: Record<string, Record<string, string>> = {
    python: {
      PYTHONUNBUFFERED: "1",
    },
    rust: {
      RUST_BACKTRACE: "1",
    },
  };

  return languageEnv[config.baseLanguage] || {};
}

// Get default test content for validation
export function getDefaultTestContent(config: LspAdapter): string {
  const testContent: Record<string, string> = {
    python: "# Python test file\nimport sys\n\ndef test():\n    pass\n",
    typescript: "// TypeScript test file\nconst test = (): void => {};\n",
    javascript: "// JavaScript test file\nconst test = () => {};\n",
    rust: "// Rust test file\nfn test() {}\n",
    go: "// Go test file\npackage main\n\nfunc test() {}\n",
    fsharp: "// F# test file\nlet test () = ()\n",
  };

  return (
    testContent[config.baseLanguage] ||
    `# Test file for ${config.baseLanguage}\n`
  );
}

// Get default test file name for validation
export function getDefaultTestFileName(config: LspAdapter): string {
  const extensions: Record<string, string> = {
    python: "test.py",
    typescript: "test.ts",
    javascript: "test.js",
    rust: "test.rs",
    go: "test.go",
    fsharp: "test.fs",
    moonbit: "test.mbt",
    deno: "test.ts",
  };

  return extensions[config.baseLanguage] || "test.txt";
}

// Start the LSP server process
export async function startLspProcess(
  config: LspAdapter,
  rootPath: string,
): Promise<ChildProcess> {
  debugLog(
    `Starting LSP server: ${config.bin} ${config.args?.join(" ") || ""}`,
  );

  try {
    const lspProcess = spawn(config.bin, config.args || [], {
      cwd: rootPath,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...getAdapterEnvironmentVariables(config) },
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

// Validate the LSP server functionality
export async function validateLspAdapter(
  config: LspAdapter,
  rootPath: string,
  options: AdapterValidationOptions = {},
  state?: AdapterState,
): Promise<LSPValidationResult> {
  const adapterState = state || createAdapterState();

  // Check cache first
  if (
    adapterState.healthCache &&
    Date.now() - adapterState.healthCache.lastChecked.getTime() <
      adapterState.healthCacheTimeout
  ) {
    debugLog("Using cached health check result");
    return adapterState.healthCache.validationResult;
  }

  let process: ChildProcess | null = null;

  try {
    // Start the process
    process = await startLspProcess(config, rootPath);

    // Create validator
    const validator = new LSPValidator({
      rootPath,
      process,
      languageId: config.baseLanguage,
      initializationOptions: config.initializationOptions,
      testFileContent: options.testFileContent || getDefaultTestContent(config),
      testFileName: options.testFileName || getDefaultTestFileName(config),
      timeout: options.timeout || 10000,
    });

    // Run validation
    const result = await validator.validateFull();

    // Cache the result
    adapterState.healthCache = {
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

// Get information about supported LSP features
export function getSupportedFeatures(config: LspAdapter): string[] {
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

  const unsupported = config.unsupported || [];
  return allFeatures.filter((feature) => !unsupported.includes(feature));
}

// Get information about unsupported LSP features
export function getUnsupportedFeatures(config: LspAdapter): string[] {
  return config.unsupported || [];
}

// Get diagnostic information about the adapter
export async function getAdapterDiagnosticInfo(
  config: LspAdapter,
  rootPath: string,
  state?: AdapterState,
): Promise<{
  adapter: string;
  available: boolean;
  health: AdapterHealth;
  supportedFeatures: string[];
  unsupportedFeatures: string[];
  availabilityMessage?: string;
}> {
  const adapterState = state || createAdapterState();

  const [availability, validationResult] = await Promise.all([
    checkAdapterAvailability(config),
    validateLspAdapter(config, rootPath, {}, adapterState),
  ]);

  const health: AdapterHealth = {
    isHealthy: validationResult.overallHealth === "healthy",
    validationResult,
    lastChecked: new Date(),
  };

  return {
    adapter: config.id,
    available: availability.available,
    health,
    supportedFeatures: getSupportedFeatures(config),
    unsupportedFeatures: getUnsupportedFeatures(config),
    availabilityMessage: availability.message,
  };
}

// Create adapter manager for stateful operations
export interface AdapterManager {
  config: LspAdapter;
  checkAvailability(): Promise<{ available: boolean; message?: string }>;
  startProcess(rootPath: string): Promise<ChildProcess>;
  validate(
    rootPath: string,
    options?: AdapterValidationOptions,
  ): Promise<LSPValidationResult>;
  getHealth(rootPath: string): Promise<AdapterHealth>;
  clearHealthCache(): void;
  getSupportedFeatures(): string[];
  getUnsupportedFeatures(): string[];
  getDiagnosticInfo(rootPath: string): Promise<{
    adapter: string;
    available: boolean;
    health: AdapterHealth;
    supportedFeatures: string[];
    unsupportedFeatures: string[];
    availabilityMessage?: string;
  }>;
}

// Create an adapter manager with stateful operations
export function createAdapterManager(config: LspAdapter): AdapterManager {
  const state = createAdapterState();

  return {
    config,

    checkAvailability: () => checkAdapterAvailability(config),

    startProcess: (rootPath: string) => startLspProcess(config, rootPath),

    validate: (rootPath: string, options?: AdapterValidationOptions) =>
      validateLspAdapter(config, rootPath, options, state),

    getHealth: async (rootPath: string) => {
      if (
        state.healthCache &&
        Date.now() - state.healthCache.lastChecked.getTime() <
          state.healthCacheTimeout
      ) {
        return state.healthCache;
      }

      const validationResult = await validateLspAdapter(
        config,
        rootPath,
        {},
        state,
      );

      return {
        isHealthy: validationResult.overallHealth === "healthy",
        validationResult,
        lastChecked: new Date(),
      };
    },

    clearHealthCache: () => {
      state.healthCache = null;
    },

    getSupportedFeatures: () => getSupportedFeatures(config),

    getUnsupportedFeatures: () => getUnsupportedFeatures(config),

    getDiagnosticInfo: (rootPath: string) =>
      getAdapterDiagnosticInfo(config, rootPath, state),
  };
}
