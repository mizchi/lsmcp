#!/usr/bin/env node
/**
 * lsmcp - Language Service MCP
 *
 * Main entry point for the lsmcp tool that provides MCP integration
 * for TypeScript/JavaScript (built-in) or any LSP server (via --bin).
 */

import { parseArgs } from "node:util";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { debug } from "./_mcplib.ts";
import { ErrorContext, formatError } from "./utils/errorHandler.ts";
import { readFile } from "fs/promises";
import type { LanguageConfig, LspAdapter } from "../types.ts";
import { resolveAdapterCommand } from "../adapters/utils.ts";

// Import all adapters
import { typescriptAdapter } from "../adapters/typescript-language-server.ts";
import { tsgoAdapter } from "../adapters/tsgo.ts";
import { denoAdapter } from "../adapters/deno.ts";
import { pyrightAdapter } from "../adapters/pyright.ts";
import { ruffAdapter } from "../adapters/ruff.ts";
import { rustAnalyzerAdapter } from "../adapters/rust-analyzer.ts";
import { fsacAdapter } from "../adapters/fsac.ts";
import { moonbitLanguageServerAdapter } from "../adapters/moonbit.ts";

// Simple maps for languages and adapters
const languages = new Map<string, LanguageConfig>();
const adapters = new Map<string, LspAdapter>();

// Languages are now handled through adapters

// Register adapters
adapters.set("typescript", typescriptAdapter);
adapters.set("tsgo", tsgoAdapter);
adapters.set("deno", denoAdapter);
adapters.set("pyright", pyrightAdapter);
adapters.set("ruff", ruffAdapter);
adapters.set("rust-analyzer", rustAnalyzerAdapter);
adapters.set("fsac", fsacAdapter);
adapters.set("moonbit-language-server", moonbitLanguageServerAdapter);

// Helper functions
function getLanguage(id: string): LanguageConfig | undefined {
  const lang = languages.get(id);
  if (lang) return lang;

  const adapter = adapters.get(id);
  if (adapter) return adapterToLanguageConfig(adapter);

  return undefined;
}

function listLanguages(): LanguageConfig[] {
  return Array.from(languages.values());
}

function listAdapters(): LspAdapter[] {
  return Array.from(adapters.values());
}

function adapterToLanguageConfig(adapter: LspAdapter): LanguageConfig {
  return {
    id: adapter.id,
    name: adapter.name,
    extensions: adapter.extensions,
    lspCommand: adapter.lspCommand,
    lspArgs: adapter.lspArgs,
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
      description: "Language to use (typescript, moonbit, rust, etc.)",
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
  lsmcp --language <lang> [options]
  lsmcp --preset <preset> [options]
  lsmcp --bin <command> [options]

Options:
  -l, --language <lang>     Language to use (required unless --preset or --bin is provided)
  -p, --preset <preset>     Language adapter to use (e.g., tsgo, deno, pyright)
  --config <path>           Load language configuration from JSON file
  --bin <command>           Custom LSP server command (e.g., "deno lsp", "rust-analyzer")
  --include <pattern>       Glob pattern for files to get diagnostics
  --list                    List all supported languages and presets
  -h, --help               Show this help message

Examples:
  lsmcp -l typescript          Use TypeScript MCP server
  lsmcp -p tsgo                Use tsgo TypeScript preset
  lsmcp -p deno                Use Deno language server
  lsmcp -l rust                Use Rust MCP server
  lsmcp --bin "deno lsp"       Use custom LSP server
  lsmcp --include "src/**/*.ts" -l typescript  Get diagnostics for TypeScript files

Supported Languages:
  - TypeScript/JavaScript (built-in support)
  - Any language via LSP server with --bin option

Environment Variables:
  LSP_COMMAND           Custom LSP server command (overrides default)
`);
}

async function runLanguageServer(
  language: string,
  args: string[] = [],
  customEnv?: Record<string, string | undefined>,
) {
  debug(
    `[lsmcp] runLanguageServer called with language: ${language}, args: ${
      JSON.stringify(
        args,
      )
    }`,
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
  const adapter = adapters.get(language);
  let lspCommand: string;
  let lspArgs: string[];

  if (adapter) {
    // Use the adapter resolution for node_modules binaries
    const resolved = resolveAdapterCommand(adapter, process.cwd());
    lspCommand = resolved.command;
    lspArgs = resolved.args;
  } else {
    // Use the config directly
    lspCommand = typeof config.lspCommand === "function"
      ? config.lspCommand()
      : config.lspCommand;
    lspArgs = config.lspArgs || [];
  }

  if (!lspCommand) {
    console.error(
      `Error: No LSP command configured for language '${language}'.`,
    );
    console.error("Please use --bin option to specify a custom LSP server.");
    process.exit(1);
  }

  // Use generic LSP server with the detected command
  debug(`[lsmcp] Using LSP command '${lspCommand}' for language '${language}'`);
  const fullCommand = lspArgs.length > 0
    ? `${lspCommand} ${lspArgs.join(" ")}`
    : lspCommand;
  const env: Record<string, string | undefined> = {
    ...process.env,
    ...customEnv,
    LSP_COMMAND: fullCommand,
  };

  // Get the path to the generic LSP server
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const genericServerPath = join(__dirname, "generic-lsp-mcp.js");

  if (!existsSync(genericServerPath)) {
    const context: ErrorContext = {
      operation: "Generic LSP MCP server startup",
      language,
      details: { path: genericServerPath },
    };
    const error = new Error(
      `Generic LSP MCP server not found at ${genericServerPath}`,
    );
    console.error(formatError(error, context));
    process.exit(1);
  }

  debug(`Starting generic LSP MCP server: ${genericServerPath}`);

  // Forward to generic LSP server
  const serverProcess = spawn(
    "node",
    [genericServerPath, `--lsp-command=${fullCommand}`, ...args],
    {
      stdio: "inherit",
      env,
    },
  );

  serverProcess.on("error", (error) => {
    const context: ErrorContext = {
      operation: "Generic LSP MCP server process",
      language,
      details: { command: fullCommand },
    };
    console.error(formatError(error, context));
    process.exit(1);
  });

  serverProcess.on("exit", (code) => {
    process.exit(code || 0);
  });
}

async function main() {
  debug(
    `[lsmcp] main() called with values: ${
      JSON.stringify(
        values,
      )
    }, positionals: ${JSON.stringify(positionals)}`,
  );

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
      const lspCmd = typeof lang.lspCommand === "function"
        ? lang.lspCommand()
        : lang.lspCommand;
      const extensions = lang.extensions.join(", ");
      console.log(
        `  ${
          lang.id.padEnd(12)
        } - ${lang.name} (${extensions}) [requires ${lspCmd}]`,
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
    // Use generic LSP MCP server for non-TypeScript languages
    const env: Record<string, string | undefined> = {
      ...process.env,
      LSP_COMMAND: values.bin,
    };

    // Get the path to the generic LSP server
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const genericServerPath = join(__dirname, "generic-lsp-mcp.js");

    if (!existsSync(genericServerPath)) {
      const context: ErrorContext = {
        operation: "Generic LSP MCP server startup",
        details: { path: genericServerPath },
      };
      const error = new Error(
        `Generic LSP MCP server not found at ${genericServerPath}`,
      );
      console.error(formatError(error, context));
      process.exit(1);
    }

    debug(`Starting generic LSP MCP server: ${genericServerPath}`);

    // Forward to generic LSP server
    const serverArgs = [genericServerPath, `--lsp-command=${values.bin}`];

    // Forward include option if provided
    if (values.include) {
      serverArgs.push(`--include=${values.include}`);
    }

    serverArgs.push(...positionals);

    const serverProcess = spawn("node", serverArgs, {
      stdio: "inherit",
      env,
    });

    serverProcess.on("error", (error) => {
      const context: ErrorContext = {
        operation: "Generic LSP MCP server process",
        details: { command: values.bin },
      };
      console.error(formatError(error, context));
      process.exit(1);
    });

    serverProcess.on("exit", (code) => {
      process.exit(code || 0);
    });

    return;
  }

  // Note: --include option is now passed through to the language servers
  // for use with lsp_get_all_diagnostics tool

  // Determine which option was provided
  let language = values.language;

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

  // Require either --language, --preset, --config, or --bin option
  if (!language && !values.bin) {
    console.error(
      "Error: Either --language, --preset, --config, or --bin option is required",
    );
    console.error("\nExamples:");
    console.error("  lsmcp --language=typescript");
    console.error("  lsmcp --preset=tsgo");
    console.error("  lsmcp --config=./my-language.json");
    console.error('  lsmcp --bin="deno lsp"');
    console.error("\nRun 'lsmcp --help' for more information.");
    process.exit(1);
  }

  if (language) {
    debug(`[lsmcp] Running with language: ${language}`);
    // Run the appropriate language server
    await runLanguageServer(language, positionals, undefined, values.include);
  }
}

// Always run main when this script is executed directly
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
