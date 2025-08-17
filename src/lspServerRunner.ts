/**
 * LSP server runner functions
 */

import { spawn } from "child_process";
import { debug as debugLog } from "./utils/mcpHelpers.ts";
import type { McpToolDef, McpContext } from "@internal/types";
import { ErrorContext, formatError } from "./utils/errorHandler.ts";
import { errorLog } from "./utils/debugLog.ts";
import { createLSPTools } from "./tools/lsp/createLspTools.ts";
import {
  filterUnsupportedTools,
  createCapabilityFilter,
} from "./tools/filterTools.ts";
import { highLevelTools, onboardingToolsList } from "./tools/toolLists.ts";
import { getSerenityToolsList } from "./tools/index.ts";
import { createGetSymbolDetailsTool } from "./tools/highlevel/indexTools.ts";
import { resolveAdapterCommand } from "./presets/utils.ts";
import { PresetRegistry, type ExtendedLSMCPConfig } from "./config/loader.ts";
import type { LspClientConfig } from "./config/schema.ts";
import { promptHandlers } from "./mcp/prompts/promptHandlers.ts";

export async function runLanguageServerWithConfig(
  config: ExtendedLSMCPConfig,
  _positionals: string[] = [],
  customEnv?: Record<string, string | undefined>,
) {
  debugLog(
    `[lsmcp] runLanguageServerWithConfig called with config: ${JSON.stringify(
      config,
    )}`,
  );

  // Debug binFindStrategy
  if (config.binFindStrategy) {
    debugLog(
      `[lsmcp] binFindStrategy found: ${JSON.stringify(config.binFindStrategy)}`,
    );
  } else {
    debugLog(`[lsmcp] No binFindStrategy in config`);
  }

  try {
    const projectRoot = process.cwd();

    // Check required fields - bin OR binFindStrategy must be present
    if (!config.bin && !config.binFindStrategy) {
      throw new Error(
        `Missing 'bin' field in configuration. Please specify a language server command or binFindStrategy.`,
      );
    }

    // Resolve the command for node_modules binaries
    const resolved = resolveAdapterCommand(
      {
        id: config.id || config.preset || "custom",
        name: config.name || config.preset || "Custom LSP",
        bin: config.bin,
        args: config.args || [],
        files: config.files || [],
        binFindStrategy: config.binFindStrategy,
      } as LspClientConfig,
      projectRoot,
    );

    const lspProcess = spawn(resolved.command, resolved.args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...customEnv,
      },
    });

    // Create and initialize LSP client with the spawned process
    // Convert ServerCharacteristics to IServerCharacteristics (with required fields)
    const serverChars = config.serverCharacteristics
      ? {
          documentOpenDelay:
            (config.serverCharacteristics as any).documentOpenDelay ?? 100,
          operationTimeout:
            (config.serverCharacteristics as any).operationTimeout ?? 30000,
          supportsIncrementalSync: (config.serverCharacteristics as any)
            .supportsIncrementalSync,
          supportsPullDiagnostics: (config.serverCharacteristics as any)
            .supportsPullDiagnostics,
        }
      : undefined;

    // Create and initialize LSP client
    const { createAndInitializeLSPClient } = await import(
      "@internal/lsp-client"
    );
    const lspClient = await createAndInitializeLSPClient(
      projectRoot,
      lspProcess,
      config.id || config.preset || "custom",
      config.initializationOptions,
      serverChars,
    );

    // Create file system API using Node.js implementation
    const { NodeFileSystemApi } = await import(
      "./infrastructure/NodeFileSystemApi.ts"
    );
    const fileSystemApi = new NodeFileSystemApi();

    // Create MCP context
    const mcpContext: McpContext = {
      lspClient: lspClient, // Direct LSPClient instance
      fs: fileSystemApi,
      config: { ...config },
      languageId: config.preset || config.id || "custom",
    };

    // Start MCP server
    const { createMcpServerManager } = await import(
      "./utils/mcpServerHelpers.ts"
    );
    const server = createMcpServerManager({
      name: `lsmcp (${config.name})`,
      version: "0.1.0",
      capabilities: {
        tools: true,
        prompts: true,
      },
    });

    // Set context in server
    server.setContext(mcpContext);

    // Create capability filter
    const capabilityFilter = createCapabilityFilter();

    // Create LSP tools with the adapter
    const lspTools = createLSPTools(lspClient);

    // Register all tools (filtered by unsupported list AND capabilities)
    let filteredLspTools = filterUnsupportedTools(lspTools, config.unsupported);

    // Apply capability-based filtering
    filteredLspTools = capabilityFilter.filterTools(filteredLspTools);

    // Get Serenity tools based on config
    const serenityToolsConfig: any = {};
    if (config.languageFeatures) {
      serenityToolsConfig.languageFeatures = config.languageFeatures;
    }
    // Support both old memoryAdvanced and new experiments.memory
    const memoryEnabled =
      (config as any).experiments?.memory || (config as any).memoryAdvanced;
    if (memoryEnabled) {
      serenityToolsConfig.memoryAdvanced = memoryEnabled;
    }
    const serenityTools = getSerenityToolsList(
      Object.keys(serenityToolsConfig).length > 0
        ? serenityToolsConfig
        : undefined,
    );

    // Create get_symbol_details tool with LSP client
    const symbolDetailsTool = createGetSymbolDetailsTool(lspClient);

    const allTools: McpToolDef<any>[] = [
      ...filteredLspTools,
      ...highLevelTools, // Analysis tools are always available
      symbolDetailsTool, // High-level tool for comprehensive symbol details
      ...serenityTools, // Serenity tools for symbol editing and memory (config-based)
      ...onboardingToolsList, // Onboarding tools for symbol indexing
    ];

    // Register tools with the server
    server.registerTools(allTools);

    // Register prompts with the server
    server.registerPrompts(promptHandlers);

    // Start the server
    await server.start();
    debugLog(`lsmcp MCP server connected for: ${config.name}`);

    // Handle LSP process errors
    const fullCommand =
      resolved.args.length > 0
        ? `${resolved.command} ${resolved.args.join(" ")}`
        : resolved.command;

    lspProcess.on("error", (error) => {
      const context: ErrorContext = {
        operation: "LSP server process",
        language: config.id,
        details: { command: fullCommand },
      };
      errorLog(formatError(error, context));
      process.exit(1);
    });

    lspProcess.on("exit", (code) => {
      if (code !== 0) {
        errorLog(`LSP server exited with code ${code}`);
        process.exit(code || 1);
      }
    });
  } catch (error) {
    const context: ErrorContext = {
      operation: "MCP server startup",
      language: config.id,
      details: { command: `${config.bin} ${config.args?.join(" ") || ""}` },
    };
    errorLog(formatError(error as Error, context));
    process.exit(1);
  }
}

export async function runLanguageServer(
  language: string,
  positionals: string[] = [],
  customEnv: Record<string, string | undefined> | undefined,
  presetRegistry: PresetRegistry,
) {
  debugLog(
    `[lsmcp] runLanguageServer called with language: ${language}, args: ${JSON.stringify(
      positionals,
    )}`,
  );

  // Check if this came from a preset
  const preset = presetRegistry.get(language);
  if (!preset) {
    const supported = Array.from(presetRegistry.list());
    errorLog(`Error: Language '${language}' is not supported.`);
    errorLog(
      `Supported languages: ${supported.map((c) => c.presetId).join(", ")}`,
    );
    errorLog("Or use --bin option to specify a custom LSP server.");
    process.exit(1);
  }

  // Convert preset to adapter-like structure for compatibility
  const adapter = preset as any;

  // Use the adapter resolution for node_modules binaries
  const resolved = resolveAdapterCommand(adapter, process.cwd());
  const lspBin = resolved.command;
  const lspArgs = resolved.args;

  if (!lspBin) {
    errorLog(`Error: No LSP command configured for language '${language}'.`);
    errorLog("Please use --bin option to specify a custom LSP server.");
    process.exit(1);
  }

  // Start MCP server directly
  debugLog(`[lsmcp] Using LSP command '${lspBin}' for language '${language}'`);
  const fullCommand =
    lspArgs.length > 0 ? `${lspBin} ${lspArgs.join(" ")}` : lspBin;

  try {
    // Spawn LSP server process
    const projectRoot = process.cwd();
    const lspProcess = spawn(lspBin, lspArgs, {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...customEnv,
      },
    });

    // Initialize LSP client with the spawned process
    const initOptions = adapter?.initializationOptions as
      | Record<string, unknown>
      | undefined;
    const serverCharacteristics = adapter?.serverCharacteristics;

    // Convert ServerCharacteristics to IServerCharacteristics (with required fields)
    const serverChars = serverCharacteristics
      ? {
          documentOpenDelay: serverCharacteristics.documentOpenDelay ?? 100,
          operationTimeout: serverCharacteristics.operationTimeout ?? 30000,
          supportsIncrementalSync:
            serverCharacteristics.supportsIncrementalSync,
          supportsPullDiagnostics:
            serverCharacteristics.supportsPullDiagnostics,
        }
      : undefined;

    // Create and initialize LSP client
    const { createAndInitializeLSPClient } = await import(
      "@internal/lsp-client"
    );
    const lspClient = await createAndInitializeLSPClient(
      projectRoot,
      lspProcess,
      language,
      initOptions,
      serverChars,
    );

    // Create file system API using Node.js implementation
    const { NodeFileSystemApi } = await import(
      "./infrastructure/NodeFileSystemApi.ts"
    );
    const fileSystemApi = new NodeFileSystemApi();

    // Create MCP context
    const mcpContext: McpContext = {
      lspClient: lspClient, // Direct LSPClient instance
      fs: fileSystemApi,
      config: { ...preset },
    };

    // Start MCP server
    const { createMcpServerManager } = await import(
      "./utils/mcpServerHelpers.ts"
    );
    const server = createMcpServerManager({
      name: `lsmcp (${language})`,
      version: "0.1.0",
      capabilities: {
        tools: true,
        prompts: true,
      },
    });

    // Set context in server
    server.setContext(mcpContext);

    // Create capability filter
    const capabilityFilter = createCapabilityFilter();

    // Create LSP tools with the adapter
    const lspTools = createLSPTools(lspClient);

    // Register all tools (filtered by unsupported list AND capabilities)
    let filteredLspTools = filterUnsupportedTools(lspTools, adapter?.disable);

    // Apply capability-based filtering
    filteredLspTools = capabilityFilter.filterTools(filteredLspTools);

    // Get Serenity tools based on config
    // Note: For adapters, we need to check if languageFeatures is available
    const adapterLanguageFeatures = (adapter as any)?.languageFeatures;
    const serenityTools = getSerenityToolsList(
      adapterLanguageFeatures
        ? { languageFeatures: adapterLanguageFeatures }
        : undefined,
    );

    const allTools: McpToolDef<any>[] = [
      ...filteredLspTools,
      ...highLevelTools, // Analysis tools are always available
      ...serenityTools, // Serenity tools for symbol editing and memory (config-based)
      ...onboardingToolsList, // Onboarding tools for symbol indexing
    ];
    server.registerTools(allTools);

    // Register prompts with the server
    server.registerPrompts(promptHandlers);

    // Start the server
    await server.start();
    debugLog(`lsmcp MCP server connected for language: ${language}`);

    // Handle LSP process errors
    lspProcess.on("error", (error) => {
      const context: ErrorContext = {
        operation: "LSP server process",
        language,
        details: { command: fullCommand },
      };
      errorLog(formatError(error, context));
      process.exit(1);
    });

    lspProcess.on("exit", (code) => {
      if (code !== 0) {
        errorLog(`LSP server exited with code ${code}`);
        process.exit(code || 1);
      }
    });
  } catch (error) {
    const context: ErrorContext = {
      operation: "MCP server startup",
      language,
      details: { command: fullCommand },
    };
    errorLog(formatError(error as Error, context));
    process.exit(1);
  }
}

export async function runCustomLspServer(
  bin: string,
  customEnv?: Record<string, string | undefined>,
): Promise<void> {
  debugLog(`[lsmcp] Using custom LSP command: ${bin}`);

  try {
    // Parse the custom command
    const projectRoot = process.cwd();
    const [cmd, ...cmdArgs] = bin.split(" ");

    // Spawn LSP server process
    const lspProcess = spawn(cmd, cmdArgs, {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...customEnv,
      },
    });

    // Create and initialize LSP client
    const { createAndInitializeLSPClient } = await import(
      "@internal/lsp-client"
    );
    const lspClient = await createAndInitializeLSPClient(
      projectRoot,
      lspProcess,
      undefined,
      undefined,
      undefined,
    );

    // Create file system API using Node.js implementation
    const { NodeFileSystemApi } = await import(
      "./infrastructure/NodeFileSystemApi.ts"
    );
    const fileSystemApi = new NodeFileSystemApi();

    // Create MCP context
    const mcpContext: McpContext = {
      lspClient: lspClient, // Direct LSPClient instance
      fs: fileSystemApi,
      config: {},
    };

    // Start MCP server
    const { createMcpServerManager } = await import(
      "./utils/mcpServerHelpers.ts"
    );
    const server = createMcpServerManager({
      name: `lsmcp (custom)`,
      version: "0.1.0",
      capabilities: {
        tools: true,
        prompts: true,
      },
    });

    // Set context in server
    server.setContext(mcpContext);

    // Create capability filter
    const capabilityFilter = createCapabilityFilter();

    // Create LSP tools with the adapter
    const lspTools = createLSPTools(lspClient);

    // Register all LSP tools (filtered by capabilities) and analysis tools
    const filteredLspTools = capabilityFilter.filterTools(lspTools);
    // Get Serenity tools based on config
    // Note: adapter/resolved doesn't have languageFeatures yet - using undefined
    const serenityTools = getSerenityToolsList(undefined);

    const allTools: McpToolDef<any>[] = [
      ...filteredLspTools,
      ...highLevelTools, // Analysis tools are always available
      ...serenityTools, // Serenity tools for symbol editing and memory (config-based)
      ...onboardingToolsList, // Onboarding tools for symbol indexing
    ];
    server.registerTools(allTools);

    // Register prompts with the server
    server.registerPrompts(promptHandlers);

    // Start the server
    await server.start();
    debugLog(`lsmcp MCP server connected for custom LSP: ${bin}`);

    // Handle LSP process errors
    lspProcess.on("error", (error) => {
      const context: ErrorContext = {
        operation: "LSP server process",
        details: { command: bin },
      };
      errorLog(formatError(error, context));
      process.exit(1);
    });

    lspProcess.on("exit", (code) => {
      if (code !== 0) {
        errorLog(`LSP server exited with code ${code}`);
        process.exit(code || 1);
      }
    });
  } catch (error) {
    const context: ErrorContext = {
      operation: "MCP server startup",
      details: { command: bin },
    };
    errorLog(formatError(error as Error, context));
    process.exit(1);
  }
}
