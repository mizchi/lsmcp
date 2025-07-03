#!/usr/bin/env node
/**
 * lsmcp - Language Service MCP
 *
 * Main entry point for the lsmcp tool that provides MCP integration
 * for TypeScript/JavaScript (built-in) or any LSP server (via --bin).
 */

import { parseArgs } from "node:util";
import { spawn } from "child_process";
import { BaseMcpServer, debug, type ToolDef } from "./utils/mcpHelpers.ts";
import { ErrorContext, formatError } from "./utils/errorHandler.ts";
import { readFile } from "fs/promises";
import type { LanguageConfig, LspAdapter } from "../types.ts";
import { resolveAdapterCommand } from "../adapters/utils.ts";
import { initialize as initializeLSPClient } from "../lsp/lspClient.ts";
import {
  AdapterRegistry,
  ConfigLoader,
  type ConfigSources,
} from "../core/config/configLoader.ts";

// Import LSP tools
import { lspGetHoverTool } from "../lsp/tools/lspGetHover.ts";
import { lspFindReferencesTool } from "../lsp/tools/lspFindReferences.ts";
import { lspGetDefinitionsTool } from "../lsp/tools/lspGetDefinitions.ts";
import { lspGetDiagnosticsTool } from "../lsp/tools/lspGetDiagnostics.ts";
import { lspGetAllDiagnosticsTool } from "../lsp/tools/lspGetAllDiagnostics.ts";
import { lspRenameSymbolTool } from "../lsp/tools/lspRenameSymbol.ts";
import { lspDeleteSymbolTool } from "../lsp/tools/lspDeleteSymbol.ts";
import { lspGetDocumentSymbolsTool } from "../lsp/tools/lspGetDocumentSymbols.ts";
// import { lspGetWorkspaceSymbolsTool } from "../lsp/tools/lspGetWorkspaceSymbols.ts"; // Not implemented yet
import { lspGetCompletionTool } from "../lsp/tools/lspGetCompletion.ts";
import { lspGetSignatureHelpTool } from "../lsp/tools/lspGetSignatureHelp.ts";
import { lspFormatDocumentTool } from "../lsp/tools/lspFormatDocument.ts";
import { lspGetCodeActionsTool } from "../lsp/tools/lspGetCodeActions.ts";

// Import all adapters
import { typescriptAdapter } from "../adapters/typescript-language-server.ts";
import { tsgoAdapter } from "../adapters/tsgo.ts";
import { denoAdapter } from "../adapters/deno.ts";
import { pyrightAdapter } from "../adapters/pyright.ts";
import { ruffAdapter } from "../adapters/ruff.ts";
import { rustAnalyzerAdapter } from "../adapters/rust-analyzer.ts";
import { fsharpAdapter } from "../adapters/fsharp.ts";
import { moonbitLanguageServerAdapter } from "../adapters/moonbit.ts";

// Define LSP-only tools
const lspTools: ToolDef<any>[] = [
  lspGetHoverTool,
  lspFindReferencesTool,
  lspGetDefinitionsTool,
  lspGetDiagnosticsTool,
  lspGetAllDiagnosticsTool,
  lspRenameSymbolTool,
  lspDeleteSymbolTool,
  lspGetDocumentSymbolsTool,
  // lspGetWorkspaceSymbolsTool, // Not implemented yet
  lspGetCompletionTool,
  lspGetSignatureHelpTool,
  lspFormatDocumentTool,
  lspGetCodeActionsTool,
];

// Tool name mapping for unsupported filtering
const toolNameMap: Record<string, string> = {
  get_hover: lspGetHoverTool.name,
  find_references: lspFindReferencesTool.name,
  get_definitions: lspGetDefinitionsTool.name,
  get_diagnostics: lspGetDiagnosticsTool.name,
  get_all_diagnostics: lspGetAllDiagnosticsTool.name,
  rename_symbol: lspRenameSymbolTool.name,
  delete_symbol: lspDeleteSymbolTool.name,
  get_document_symbols: lspGetDocumentSymbolsTool.name,
  get_completion: lspGetCompletionTool.name,
  get_signature_help: lspGetSignatureHelpTool.name,
  format_document: lspFormatDocumentTool.name,
  get_code_actions: lspGetCodeActionsTool.name,
};

// Filter tools based on unsupported list
function filterUnsupportedTools(
  tools: ToolDef<any>[],
  unsupported: string[] = [],
): ToolDef<any>[] {
  if (unsupported.length === 0) return tools;

  const unsupportedToolNames = new Set(
    unsupported.map((name) => toolNameMap[name]).filter(Boolean),
  );

  return tools.filter((tool) => !unsupportedToolNames.has(tool.name));
}

// Initialize configuration system
const adapterRegistry = new AdapterRegistry();
const configLoader = new ConfigLoader(adapterRegistry);

// Register all adapters
adapterRegistry.register(typescriptAdapter);
adapterRegistry.register(tsgoAdapter);
adapterRegistry.register(denoAdapter);
adapterRegistry.register(pyrightAdapter);
adapterRegistry.register(ruffAdapter);
adapterRegistry.register(rustAnalyzerAdapter);
adapterRegistry.register(fsharpAdapter);
adapterRegistry.register(moonbitLanguageServerAdapter);

// Legacy support - will be removed in future versions
const languages = new Map<string, LanguageConfig>();

// Helper functions (legacy support)
function getLanguage(id: string): LanguageConfig | undefined {
  const lang = languages.get(id);
  if (lang) return lang;

  const adapter = adapterRegistry.get(id);
  if (adapter) return adapterToLanguageConfig(adapter);

  return undefined;
}

function listLanguages(): LanguageConfig[] {
  return Array.from(languages.values());
}

function listAdapters(): LspAdapter[] {
  return adapterRegistry.list();
}

function adapterToLanguageConfig(adapter: LspAdapter): LanguageConfig {
  return {
    id: adapter.id,
    name: adapter.name,
    bin: adapter.bin,
    args: adapter.args,
    initializationOptions: adapter.initializationOptions,
  };
}

function loadLanguageFromJson(json: any): LanguageConfig {
  return adapterToLanguageConfig(json);
}

// Parse command line arguments
const { values, positionals } = parseArgs({
  options: {
    language: {
      type: "string",
      short: "l",
      description: "[DEPRECATED] Use -p/--preset instead",
    },
    preset: {
      type: "string",
      short: "p",
      description:
        "Language adapter to use (typescript-language-server, tsgo, deno, pyright, etc.)",
    },
    config: {
      type: "string",
      description:
        "Path to JSON configuration file for custom language definition",
    },
    bin: {
      type: "string",
      description:
        'Custom LSP server command (e.g., "deno lsp", "rust-analyzer")',
    },
    include: {
      type: "string",
      description:
        'Glob pattern for files to get diagnostics (e.g., "src/**/*.ts")',
    },
    initializationOptions: {
      type: "string",
      description:
        "JSON string for LSP initialization options (e.g., '{}', '[object Object]')",
    },
    help: {
      type: "boolean",
      short: "h",
      description: "Show help message",
    },
    list: {
      type: "boolean",
      description: "List supported languages and presets",
    },
  },
  allowPositionals: true,
});

function showHelp() {
  console.log(`
🌍 LSMCP - Language Service MCP for Multi-Language Support

Usage:
  lsmcp -p <preset> [options]
  lsmcp --bin <command> --extensions=<extensions> [options]

Options:
  -p, --preset <preset>     Language adapter to use (e.g., tsgo, deno, pyright)
  -l, --language <lang>     [DEPRECATED] Use -p/--preset instead
  --config <path>           Load language configuration from JSON file
  --bin <command>           Custom LSP server command (e.g., "deno lsp", "rust-analyzer")
  --initializationOptions <json>  JSON string for LSP initialization options
  --list                    List all supported languages and presets
  -h, --help               Show this help message

Examples:
  lsmcp -p typescript          Use TypeScript MCP server
  lsmcp -p tsgo                Use tsgo TypeScript preset
  lsmcp -p deno                Use Deno language server
  lsmcp -p rust                Use Rust MCP server
  lsmcp --bin "deno lsp"       Use custom LSP server
  lsmcp --include "src/**/*.ts" -p typescript  Get diagnostics for TypeScript files
`);
}

async function runLanguageServerWithConfig(
  config: import("../core/config/configLoader.ts").ResolvedConfig,
  _positionals: string[] = [],
  customEnv?: Record<string, string | undefined>,
) {
  debug(
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

    // Register all tools (filtered by unsupported list)
    const filteredLspTools = filterUnsupportedTools(
      lspTools,
      config.unsupported,
    );
    const allTools: ToolDef<import("zod").ZodType>[] = [...filteredLspTools];

    // Add custom tools if available (note: would need adapter lookup for this)
    server.registerTools(allTools);

    // Start the server
    await server.start();
    debug(`lsmcp MCP server connected for: ${config.name}`);

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

async function runLanguageServer(
  language: string,
  positionals: string[] = [],
  customEnv?: Record<string, string | undefined>,
) {
  debug(
    `[lsmcp] runLanguageServer called with language: ${language}, args: ${JSON.stringify(
      positionals,
    )}`,
  );

  // Get language configuration
  const config = getLanguage(language);
  if (!config) {
    const supported = listLanguages();
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
  debug(`[lsmcp] Using LSP command '${lspBin}' for language '${language}'`);
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

    // Register all tools (filtered by unsupported list)
    const filteredLspTools = filterUnsupportedTools(
      lspTools,
      adapter?.unsupported,
    );
    const allTools: ToolDef<import("zod").ZodType>[] = [...filteredLspTools];
    if (adapter?.customTools) {
      allTools.push(...adapter.customTools);
    }
    server.registerTools(allTools);

    // Start the server
    await server.start();
    debug(`lsmcp MCP server connected for language: ${language}`);

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

async function main() {
  debug(
    `[lsmcp] main() called with values: ${JSON.stringify(
      values,
    )}, positionals: ${JSON.stringify(positionals)}`,
  );

  // Use new configuration system when possible
  if (values.preset || values.config || values.bin) {
    return await mainWithConfigLoader();
  }

  // Fall back to legacy behavior for backward compatibility
  return await mainLegacy();
}

async function mainWithConfigLoader() {
  debug("[lsmcp] Using new configuration system");

  // Show help if requested
  if (values.help) {
    showHelp();
    process.exit(0);
  }

  // List languages if requested
  if (values.list) {
    console.log("Available adapters with --preset:");
    const adapterList = adapterRegistry.list();
    for (const adapter of adapterList) {
      console.log(`  ${adapter.id.padEnd(25)} - ${adapter.description}`);
    }

    console.log("\nFor custom language configuration, use --config:");
    console.log('  --config "./my-language.json"');
    console.log("\nFor other languages or custom LSP servers, use --bin:");
    console.log('  --bin "deno lsp" for Deno');
    console.log('  --bin "clangd" for C/C++');
    console.log('  --bin "jdtls" for Java');
    process.exit(0);
  }

  try {
    // Prepare configuration sources
    const sources: ConfigSources = {};

    if (values.preset) {
      sources.preset = values.preset;
    }

    if (values.config) {
      sources.configFile = values.config;
    }

    if (values.bin) {
      const parsedBin = ConfigLoader.parseBinString(values.bin);
      sources.overrides = {
        bin: parsedBin.bin,
        args: parsedBin.args,
      };
    }

    if (values.initializationOptions) {
      try {
        const parsedOptions = JSON.parse(values.initializationOptions);
        if (!sources.overrides) {
          sources.overrides = {};
        }
        sources.overrides.initializationOptions = parsedOptions;
      } catch (error) {
        console.error(
          `Error parsing initializationOptions JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        process.exit(1);
      }
    }

    // Load configuration
    const config = await configLoader.loadConfig(sources);

    // Display final configuration details
    debug(`[lsmcp] ===== Final Configuration =====`);
    debug(`[lsmcp] Adapter ID: ${config.id}`);
    debug(`[lsmcp] Name: ${config.name}`);
    debug(`[lsmcp] Command: ${config.bin}`);
    debug(`[lsmcp] Arguments: ${JSON.stringify(config.args)}`);
    if (config.baseLanguage) {
      debug(`[lsmcp] Base Language: ${config.baseLanguage}`);
    }
    if (config.description) {
      debug(`[lsmcp] Description: ${config.description}`);
    }
    if (config.unsupported && config.unsupported.length > 0) {
      debug(`[lsmcp] Unsupported features: ${config.unsupported.join(", ")}`);
    }
    if (config.initializationOptions) {
      debug(
        `[lsmcp] Initialization Options: ${JSON.stringify(
          config.initializationOptions,
          null,
          2,
        )}`,
      );
    }
    debug(`[lsmcp] ================================`);

    // Start LSP server with resolved configuration
    await runLanguageServerWithConfig(config, positionals);
  } catch (error) {
    console.error(
      `Configuration error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }
}

async function mainLegacy() {
  debug("[lsmcp] Using legacy configuration system");

  // Show help if requested
  if (values.help) {
    showHelp();
    process.exit(0);
  }

  // List languages if requested
  if (values.list) {
    console.log("Supported languages with --language:");
    const languageList = listLanguages();
    for (const lang of languageList) {
      const lspCmd = lang.bin;
      console.log(
        `  ${lang.id.padEnd(12)} - ${lang.name} [requires ${lspCmd}]`,
      );
    }

    console.log("\nAvailable adapters with --preset:");
    const adapterList = listAdapters();
    for (const adapter of adapterList) {
      console.log(`  ${adapter.id.padEnd(25)} - ${adapter.description}`);
    }

    console.log("\nFor other languages or custom LSP servers, use --bin:");
    console.log('  --bin "deno lsp" for Deno');
    console.log('  --bin "clangd" for C/C++');
    console.log('  --bin "jdtls" for Java');
    console.log("\nFor custom language configuration, use --config:");
    console.log('  --config "./my-language.json"');
    process.exit(0);
  }

  // Check if custom LSP command is provided
  if (values.bin) {
    debug(`[lsmcp] Using custom LSP command: ${values.bin}`);

    try {
      // Parse the custom command
      const projectRoot = process.cwd();
      const [cmd, ...cmdArgs] = values.bin.split(" ");

      // Spawn LSP server process
      const lspProcess = spawn(cmd, cmdArgs, {
        cwd: projectRoot,
        env: process.env,
      });

      // Initialize LSP client with the spawned process
      await initializeLSPClient(projectRoot, lspProcess);

      // Start MCP server
      const server = new BaseMcpServer({
        name: `lsmcp (custom)`,
        version: "0.1.0",
      });

      // Register all LSP tools
      server.registerTools(lspTools);

      // Start the server
      await server.start();
      debug(`lsmcp MCP server connected for custom LSP: ${values.bin}`);

      // Handle LSP process errors
      lspProcess.on("error", (error) => {
        const context: ErrorContext = {
          operation: "LSP server process",
          details: { command: values.bin },
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
        details: { command: values.bin },
      };
      console.error(formatError(error as Error, context));
      process.exit(1);
    }

    return;
  }

  // Note: --include option is now passed through to the language servers
  // for use with lsp_get_all_diagnostics tool

  // Determine which option was provided
  let language = values.language;

  // Handle -l option as alias for -p (deprecated)
  if (values.language && !values.preset) {
    console.warn(
      "⚠️  Warning: The -l/--language option is deprecated. Please use -p/--preset instead.",
    );
    console.warn(`   Example: lsmcp -p ${values.language}`);
    console.warn("");

    // Treat -l as -p for backward compatibility
    values.preset = values.language;
    language = undefined;
  }

  // Handle preset/adapter option
  if (values.preset) {
    const adapter = getLanguage(values.preset);
    if (!adapter) {
      console.error(`Error: Adapter '${values.preset}' is not supported.`);
      const adapterList = listAdapters();
      console.error(
        `Available adapters: ${adapterList.map((a) => a.id).join(", ")}`,
      );
      process.exit(1);
    }
    language = values.preset;
  }

  // Handle config option
  if (values.config) {
    try {
      const configPath = values.config as string;
      const configJson = JSON.parse(await readFile(configPath, "utf-8"));
      const customConfig = loadLanguageFromJson(configJson);
      languages.set(customConfig.id, customConfig);
      language = customConfig.id;
    } catch (error) {
      console.error(
        `Error loading config file: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      process.exit(1);
    }
  }

  debug(`[lsmcp] Resolved language: ${language}`);

  // Require either --preset, --config, or --bin option
  if (!language && !values.bin) {
    console.error(
      "Error: Either --preset, --config, or --bin option is required",
    );
    console.error("\nExamples:");
    console.error("  lsmcp --preset=typescript");
    console.error("  lsmcp --preset=tsgo");
    console.error("  lsmcp --config=./my-language.json");
    console.error('  lsmcp --bin="deno lsp"');
    console.error("\nRun 'lsmcp --help' for more information.");
    process.exit(1);
  }

  if (language) {
    debug(`[lsmcp] Running with language: ${language}`);

    // Display configuration details for legacy system
    const config = getLanguage(language);
    if (config) {
      debug(`[lsmcp] ===== Final Configuration (Legacy) =====`);
      debug(`[lsmcp] Language ID: ${config.id}`);
      debug(`[lsmcp] Name: ${config.name}`);
      debug(`[lsmcp] Command: ${config.bin}`);
      debug(`[lsmcp] Arguments: ${JSON.stringify(config.args || [])}`);
      if (config.initializationOptions) {
        debug(
          `[lsmcp] Initialization Options: ${JSON.stringify(
            config.initializationOptions,
            null,
            2,
          )}`,
        );
      }
      debug(`[lsmcp] ==========================================`);
    }

    // Run the appropriate language server
    await runLanguageServer(language, positionals, undefined);
  }
}

// Always run main when this script is executed directly
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
