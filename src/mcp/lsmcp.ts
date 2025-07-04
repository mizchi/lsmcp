#!/usr/bin/env node
/**
 * lsmcp - Language Service MCP
 *
 * Main entry point for the lsmcp tool that provides MCP integration
 * for TypeScript/JavaScript (built-in) or any LSP server (via --bin).
 */

import { parseArgs } from "node:util";
import { debug as debugLog } from "./utils/mcpHelpers.ts";
import { readFile } from "fs/promises";
import {
  AdapterRegistry,
  ConfigLoader,
  type ConfigSources,
} from "../core/config/configLoader.ts";

// Import modular components
import { registerBuiltinAdapters } from "./registry/adapterSetup.ts";
import {
  getLanguage,
  setLanguage,
  listAdapters,
  loadLanguageFromJson,
} from "./legacy/legacySupport.ts";
import {
  showHelp,
  showListWithConfigLoader,
  showListLegacy,
} from "./cli/help.ts";
import {
  runLanguageServerWithConfig,
  runLanguageServer,
  runCustomLspServer,
} from "./server/lspServerRunner.ts";

// Initialize configuration system
const adapterRegistry = new AdapterRegistry();
const configLoader = new ConfigLoader(adapterRegistry);

// Register all adapters
registerBuiltinAdapters(adapterRegistry);

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

async function main() {
  debugLog(
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

async function mainLegacy() {
  debugLog("[lsmcp] Using legacy configuration system");

  // Show help if requested
  if (values.help) {
    showHelp();
    process.exit(0);
  }

  // List languages if requested
  if (values.list) {
    showListLegacy(adapterRegistry);
    process.exit(0);
  }

  // Check if custom LSP command is provided
  if (values.bin) {
    await runCustomLspServer(values.bin as string);
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
    const adapter = getLanguage(values.preset, adapterRegistry);
    if (!adapter) {
      console.error(`Error: Adapter '${values.preset}' is not supported.`);
      const adapterList = listAdapters(adapterRegistry);
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
      setLanguage(customConfig.id, customConfig);
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

  debugLog(`[lsmcp] Resolved language: ${language}`);

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
    debugLog(`[lsmcp] Running with language: ${language}`);

    // Display configuration details for legacy system
    const config = getLanguage(language, adapterRegistry);
    if (config) {
      debugLog(`[lsmcp] ===== Final Configuration (Legacy) =====`);
      debugLog(`[lsmcp] Language ID: ${config.id}`);
      debugLog(`[lsmcp] Name: ${config.name}`);
      debugLog(`[lsmcp] Command: ${config.bin}`);
      debugLog(`[lsmcp] Arguments: ${JSON.stringify(config.args || [])}`);
      if (config.initializationOptions) {
        debugLog(
          `[lsmcp] Initialization Options: ${JSON.stringify(
            config.initializationOptions,
            null,
            2,
          )}`,
        );
      }
      debugLog(`[lsmcp] ==========================================`);
    }

    // Run the appropriate language server
    await runLanguageServer(language, positionals, undefined, adapterRegistry);
  }
}

// Always run main when this script is executed directly
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
