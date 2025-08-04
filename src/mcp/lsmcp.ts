#!/usr/bin/env node
/**
 * lsmcp - Language Service MCP
 *
 * Main entry point for the lsmcp tool that provides MCP integration
 * for TypeScript/JavaScript (built-in) or any LSP server (via --bin).
 */

import { parseArgs } from "node:util";
import { debug as debugLog } from "./utils/mcpHelpers.ts";
import {
  AdapterRegistry,
  ConfigLoader,
  type ConfigSources,
} from "../core/config/configLoader.ts";

// Import modular components
import { registerBuiltinAdapters } from "./registry/adapterSetup.ts";
import { showHelp, showListWithConfigLoader } from "./cli/help.ts";
import { runLanguageServerWithConfig } from "./server/lspServerRunner.ts";

// Initialize configuration system
const adapterRegistry = new AdapterRegistry();
const configLoader = new ConfigLoader(adapterRegistry);

// Register all adapters
registerBuiltinAdapters(adapterRegistry);

// Import subcommands
import { initCommand, indexCommand } from "./cli/subcommands.ts";

// Parse command line arguments
const { values, positionals } = parseArgs({
  options: {
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

async function main() {
  debugLog(
    `[lsmcp] main() called with values: ${JSON.stringify(
      values,
    )}, positionals: ${JSON.stringify(positionals)}`,
  );

  // Handle subcommands
  const subcommand = positionals[0];

  if (subcommand === "init") {
    await initCommand(process.cwd(), values.preset, adapterRegistry);
    process.exit(0);
  }

  if (subcommand === "index") {
    await indexCommand(process.cwd());
    process.exit(0);
  }

  // Always use new configuration system
  return await mainWithConfigLoader();
}

async function mainWithConfigLoader() {
  debugLog("[lsmcp] Using new configuration system");

  // Show help if requested
  if (values.help) {
    showHelp();
    process.exit(0);
  }

  // List languages if requested
  if (values.list) {
    showListWithConfigLoader(adapterRegistry);
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
    debugLog(`[lsmcp] ===== Final Configuration =====`);
    debugLog(`[lsmcp] Adapter ID: ${config.id}`);
    debugLog(`[lsmcp] Name: ${config.name}`);
    debugLog(`[lsmcp] Command: ${config.bin}`);
    debugLog(`[lsmcp] Arguments: ${JSON.stringify(config.args)}`);
    if (config.baseLanguage) {
      debugLog(`[lsmcp] Base Language: ${config.baseLanguage}`);
    }
    if (config.description) {
      debugLog(`[lsmcp] Description: ${config.description}`);
    }
    if (config.unsupported && config.unsupported.length > 0) {
      debugLog(
        `[lsmcp] Unsupported features: ${config.unsupported.join(", ")}`,
      );
    }
    if (config.initializationOptions) {
      debugLog(
        `[lsmcp] Initialization Options: ${JSON.stringify(
          config.initializationOptions,
          null,
          2,
        )}`,
      );
    }
    debugLog(`[lsmcp] ================================`);

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

// Always run main when this script is executed directly
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
