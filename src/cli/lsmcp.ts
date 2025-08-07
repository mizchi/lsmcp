#!/usr/bin/env node
/**
 * lsmcp - Language Service MCP
 *
 * Main entry point for the lsmcp tool that provides MCP integration
 * for TypeScript/JavaScript (built-in) or any LSP server (via --bin).
 */

import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { debug as debugLog } from "../mcp/utils/mcpHelpers.ts";
import {
  AdapterRegistry,
  ConfigLoader as LspConfigLoader,
  type ConfigSources as LspConfigSources,
} from "../core/config/configLoader.ts";

// Import modular components
import { registerBuiltinAdapters } from "../mcp/registry/adapterSetup.ts";
import { showHelp, showListWithConfigLoader, showNoArgsHelp } from "./help.ts";
import { runLanguageServerWithConfig } from "../mcp/server/lspServerRunner.ts";

// Initialize configuration system
const adapterRegistry = new AdapterRegistry();
const lspConfigLoader = new LspConfigLoader(adapterRegistry);

// Register all adapters
registerBuiltinAdapters(adapterRegistry);

// Import subcommands
import { initCommand, indexCommand } from "./subcommands.ts";
import { detectProjectType } from "./projectDetector.ts";

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
    "auto-index": {
      type: "boolean",
      description: "Automatically build symbol index after init",
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
    await initCommand(
      process.cwd(),
      values.preset,
      adapterRegistry,
      lspConfigLoader,
      values["auto-index"],
    );
    process.exit(0);
  }

  if (subcommand === "index") {
    await indexCommand(process.cwd(), false, lspConfigLoader, adapterRegistry);
    process.exit(0);
  }

  // If no arguments provided and no config exists, try auto-detection
  if (
    !values.preset &&
    !values.config &&
    !values.bin &&
    !values.help &&
    !values.list &&
    positionals.length === 0
  ) {
    // Check if .lsmcp/config.json exists
    const configPath = join(process.cwd(), ".lsmcp", "config.json");
    if (!existsSync(configPath)) {
      // Try auto-detection
      debugLog("[lsmcp] No config found, attempting auto-detection");
      const detected = await detectProjectType(process.cwd());

      if (detected.length === 1) {
        // Single match - use it automatically
        debugLog(
          `[lsmcp] Auto-detected ${detected[0].preset}: ${detected[0].reason}`,
        );
        values.preset = detected[0].preset;
      } else if (detected.length === 0) {
        // No detection - show help
        showNoArgsHelp(adapterRegistry);
        process.exit(0);
      } else {
        // Multiple matches - show help with detected info
        console.log("\n🌍 LSMCP - Language Service MCP\n");
        console.log("Multiple project types detected:");
        detected.forEach((d) => {
          console.log(`  • ${d.preset}: ${d.reason}`);
        });
        console.log("\nPlease specify which preset to use:");
        detected.forEach((d) => {
          console.log(`  lsmcp -p ${d.preset}`);
        });
        console.log("\nOr initialize with: lsmcp init");
        process.exit(0);
      }
    }
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
    // Prepare configuration sources for LSP
    const lspSources: LspConfigSources = {};

    // Check for .lsmcp/config.json
    const configPath = join(process.cwd(), ".lsmcp", "config.json");
    if (
      existsSync(configPath) &&
      !values.preset &&
      !values.config &&
      !values.bin
    ) {
      debugLog("[lsmcp] Loading config from .lsmcp/config.json");
      lspSources.configFile = configPath;
    }

    if (values.preset) {
      lspSources.preset = values.preset;
    }

    if (values.config) {
      lspSources.configFile = values.config;
    }

    if (values.bin) {
      const parsedBin = LspConfigLoader.parseBinString(values.bin);
      lspSources.overrides = {
        bin: parsedBin.bin,
        args: parsedBin.args,
      };
    }

    if (values.initializationOptions) {
      try {
        const parsedOptions = JSON.parse(values.initializationOptions);
        if (!lspSources.overrides) {
          lspSources.overrides = {};
        }
        lspSources.overrides.initializationOptions = parsedOptions;
      } catch (error) {
        console.error(
          `Error parsing initializationOptions JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        process.exit(1);
      }
    }

    // Load LSP configuration
    const config = await lspConfigLoader.loadConfig(lspSources);

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
