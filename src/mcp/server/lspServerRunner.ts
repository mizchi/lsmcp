/**
 * LSP server runner functions
 */

import { spawn } from "child_process";
import { initialize as initializeLSPClient } from "../../lsp/lspClient.ts";
import {
  BaseMcpServer,
  debug as debugLog,
  type ToolDef,
} from "../utils/mcpHelpers.ts";
import { ErrorContext, formatError } from "../utils/errorHandler.ts";
import { filterUnsupportedTools, lspTools } from "../registry/toolRegistry.ts";
import { createCapabilityFilter } from "../registry/capabilityFilter.ts";
import { resolveAdapterCommand } from "../../adapters/utils.ts";
import type { ResolvedConfig } from "../../core/config/configLoader.ts";
import type { AdapterRegistry } from "../../core/config/configLoader.ts";
import { getLanguage } from "../legacy/legacySupport.ts";

export async function runLanguageServerWithConfig(
  config: ResolvedConfig,
  _positionals: string[] = [],
  customEnv?: Record<string, string | undefined>,
) {
  debugLog(
    `[lsmcp] runLanguageServerWithConfig called with config: ${JSON.stringify(
      config,
    )}`,
  );

  try {
    const projectRoot = process.cwd();
    const lspProcess = spawn(config.bin, config.args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...customEnv,
      },
    });

    // Initialize LSP client with the spawned process
    await initializeLSPClient(
      projectRoot,
      lspProcess,
      config.id,
      config.initializationOptions,
    );

    // Start MCP server
    const server = new BaseMcpServer({
      name: `lsmcp (${config.name})`,
      version: "0.1.0",
    });

    // Create capability filter
    const capabilityFilter = createCapabilityFilter();

    // Register all tools (filtered by unsupported list AND capabilities)
    let filteredLspTools = filterUnsupportedTools(lspTools, config.unsupported);

    // Apply capability-based filtering
    filteredLspTools = capabilityFilter.filterTools(filteredLspTools);

    const allTools: ToolDef<import("zod").ZodType>[] = [...filteredLspTools];

    // Add custom tools if available (note: would need adapter lookup for this)
    server.registerTools(allTools);

    // Start the server
    await server.start();
    debugLog(`lsmcp MCP server connected for: ${config.name}`);

    // Handle LSP process errors
    const fullCommand =
      config.args.length > 0
        ? `${config.bin} ${config.args.join(" ")}`
        : config.bin;

    lspProcess.on("error", (error) => {
      const context: ErrorContext = {
        operation: "LSP server process",
        language: config.id,
        details: { command: fullCommand },
      };
      console.error(formatError(error, context));
      process.exit(1);
    });

    lspProcess.on("exit", (code) => {
      if (code !== 0) {
        console.error(`LSP server exited with code ${code}`);
        process.exit(code || 1);
      }
    });
  } catch (error) {
    const context: ErrorContext = {
      operation: "MCP server startup",
      language: config.id,
      details: { command: `${config.bin} ${config.args.join(" ")}` },
    };
    console.error(formatError(error as Error, context));
    process.exit(1);
  }
}

export async function runLanguageServer(
  language: string,
  positionals: string[] = [],
  customEnv: Record<string, string | undefined> | undefined,
  adapterRegistry: AdapterRegistry,
) {
  debugLog(
    `[lsmcp] runLanguageServer called with language: ${language}, args: ${JSON.stringify(
      positionals,
    )}`,
  );

  // Get language configuration
  const config = getLanguage(language, adapterRegistry);
  if (!config) {
    const supported = Array.from(adapterRegistry.list());
    console.error(`Error: Language '${language}' is not supported.`);
    console.error(
      `Supported languages: ${supported.map((c) => c.id).join(", ")}`,
    );
    console.error("Or use --bin option to specify a custom LSP server.");
    process.exit(1);
  }

  // Check if this came from an adapter
  const adapter = adapterRegistry.get(language);
  let lspBin: string;
  let lspArgs: string[];

  if (adapter) {
    // Use the adapter resolution for node_modules binaries
    const resolved = resolveAdapterCommand(adapter, process.cwd());
    lspBin = resolved.command;
    lspArgs = resolved.args;
  } else {
    // Use the config directly
    lspBin = config.bin;
    lspArgs = config.args || [];
  }

  if (!lspBin) {
    console.error(
      `Error: No LSP command configured for language '${language}'.`,
    );
    console.error("Please use --bin option to specify a custom LSP server.");
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
    const initOptions = adapter?.initializationOptions || undefined;
    await initializeLSPClient(projectRoot, lspProcess, language, initOptions);

    // Start MCP server
    const server = new BaseMcpServer({
      name: `lsmcp (${language})`,
      version: "0.1.0",
    });

    // Create capability filter
    const capabilityFilter = createCapabilityFilter();

    // Register all tools (filtered by unsupported list AND capabilities)
    let filteredLspTools = filterUnsupportedTools(
      lspTools,
      adapter?.unsupported,
    );

    // Apply capability-based filtering
    filteredLspTools = capabilityFilter.filterTools(filteredLspTools);

    const allTools: ToolDef<import("zod").ZodType>[] = [...filteredLspTools];
    if (adapter?.customTools) {
      allTools.push(...adapter.customTools);
    }
    server.registerTools(allTools);

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
      console.error(formatError(error, context));
      process.exit(1);
    });

    lspProcess.on("exit", (code) => {
      if (code !== 0) {
        console.error(`LSP server exited with code ${code}`);
        process.exit(code || 1);
      }
    });
  } catch (error) {
    const context: ErrorContext = {
      operation: "MCP server startup",
      language,
      details: { command: fullCommand },
    };
    console.error(formatError(error as Error, context));
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

    // Initialize LSP client with the spawned process
    await initializeLSPClient(projectRoot, lspProcess);

    // Start MCP server
    const server = new BaseMcpServer({
      name: `lsmcp (custom)`,
      version: "0.1.0",
    });

    // Create capability filter
    const capabilityFilter = createCapabilityFilter();

    // Register all LSP tools (filtered by capabilities)
    const filteredLspTools = capabilityFilter.filterTools(lspTools);
    server.registerTools(filteredLspTools);

    // Start the server
    await server.start();
    debugLog(`lsmcp MCP server connected for custom LSP: ${bin}`);

    // Handle LSP process errors
    lspProcess.on("error", (error) => {
      const context: ErrorContext = {
        operation: "LSP server process",
        details: { command: bin },
      };
      console.error(formatError(error, context));
      process.exit(1);
    });

    lspProcess.on("exit", (code) => {
      if (code !== 0) {
        console.error(`LSP server exited with code ${code}`);
        process.exit(code || 1);
      }
    });
  } catch (error) {
    const context: ErrorContext = {
      operation: "MCP server startup",
      details: { command: bin },
    };
    console.error(formatError(error as Error, context));
    process.exit(1);
  }
}
