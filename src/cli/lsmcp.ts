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
import { debug as debugLog } from "../utils/mcpHelpers.ts";
import {
  ConfigLoader as LspConfigLoader,
  globalPresetRegistry,
  type ConfigSources,
} from "../config/loader.ts";
import type { Preset } from "../config/schema.ts";

// Import modular components
import { registerBuiltinAdapters } from "../config/presets.ts";
import { showHelp, showListWithConfigLoader, showNoArgsHelp } from "./help.ts";
import { errorLog } from "../utils/debugLog.ts";
import { runLanguageServerWithConfig } from "../lspServerRunner.ts";

// Initialize configuration system
const adapterRegistry = globalPresetRegistry;
const lspConfigLoader = new LspConfigLoader(process.cwd());

// Register all adapters
registerBuiltinAdapters(adapterRegistry);

// Import subcommands
import { initCommand, indexCommand } from "./subcommands.ts";
import { doctorCommand } from "./doctor.ts";
import { detectProjectType } from "../utils/projectDetector.ts";

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
    files: {
      type: "string",
      description:
        'File patterns for custom LSP (required with --bin, e.g., "**/*.rs")',
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

  if (subcommand === "doctor") {
    await doctorCommand(process.cwd(), {
      preset: values.preset,
      json: values.list, // Reuse list flag for JSON output
    });
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
    const lspSources: ConfigSources = {};

    // Check for .lsmcp/config.json
    const configPath = join(process.cwd(), ".lsmcp", "config.json");
    const hasConfigFile = existsSync(configPath);
    const hasExplicitConfig = values.preset || values.config || values.bin;

    // If no preset and no config file, --files is required
    if (!values.preset && !values.config && !values.bin && !hasConfigFile) {
      if (!values.files) {
        errorLog(
          "Error: Either --preset, --config, --bin, or --files is required",
        );
        errorLog("");
        errorLog("Options:");
        errorLog("  lsmcp --preset tsgo                    # Use a preset");
        errorLog(
          '  lsmcp --files "**/*.ts,**/*.tsx"       # Specify file patterns',
        );
        errorLog(
          '  lsmcp --bin "deno lsp" --files "**/*.ts"  # Custom LSP server',
        );
        errorLog("");
        errorLog("Available presets:");
        const presets = globalPresetRegistry.list();
        presets.forEach((p) => {
          errorLog(`  - ${p.presetId}: ${p.name || p.presetId}`);
        });
        process.exit(1);
      }
    }

    if (hasConfigFile && !hasExplicitConfig) {
      debugLog("[lsmcp] Loading config from .lsmcp/config.json");
      lspSources.configFile = configPath;
    } else if (!hasConfigFile && !hasExplicitConfig && !values.files) {
      // Auto-detect environment
      const { detectEnvironment, formatEnvironmentGuide } = await import(
        "../utils/environmentDetector.ts"
      );
      const detected = detectEnvironment(process.cwd());

      if (detected) {
        errorLog(formatEnvironmentGuide(detected));
        errorLog("");
        errorLog("Or run with explicit preset:");
        errorLog(`  lsmcp --preset ${detected.preset}`);
        errorLog("");
        process.exit(1);
      }
    }

    if (values.preset) {
      lspSources.preset = values.preset;
    }

    if (values.config) {
      lspSources.configFile = values.config;
    }

    if (values.bin) {
      // When using --bin, --files is required
      if (!values.files) {
        errorLog("Error: --files is required when using --bin");
        errorLog("");
        errorLog("Example:");
        errorLog('  lsmcp --bin "clangd" --files "**/*.{c,cpp,h,hpp}"');
        errorLog('  lsmcp --bin "rust-analyzer" --files "**/*.rs"');
        errorLog('  lsmcp --bin "gopls" --files "**/*.go"');
        errorLog("");
        errorLog(
          "The --files pattern specifies which files the LSP server should handle.",
        );
        process.exit(1);
      }

      // Create custom preset from bin string
      const parts = values.bin.split(" ");
      const customPreset: Preset = {
        presetId: "custom",
        bin: parts[0],
        args: parts.slice(1),
        files: values.files.split(",").map((p) => p.trim()),
      };
      globalPresetRegistry.register(customPreset);
      lspSources.preset = "custom";
    }

    // Handle --files without preset or bin
    if (values.files && !values.preset && !values.bin) {
      // When --files is specified without preset/bin, use it directly
      if (!lspSources.config) {
        lspSources.config = {};
      }
      lspSources.config.files = values.files.split(",").map((p) => p.trim());
    }

    if (values.initializationOptions) {
      try {
        const parsedOptions = JSON.parse(values.initializationOptions);
        // Store initialization options for later use
        if (!lspSources.config) {
          lspSources.config = {
            initializationOptions: parsedOptions,
          };
        } else {
          lspSources.config.initializationOptions = parsedOptions;
        }
      } catch (error) {
        errorLog(
          `Error parsing initializationOptions JSON: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        process.exit(1);
      }
    }

    // Load LSP configuration
    const result = await lspConfigLoader.load(lspSources);
    const config = result.config; // Extended config includes preset properties

    // Display final configuration details
    debugLog(`[lsmcp] ===== Final Configuration =====`);
    debugLog(`[lsmcp] Adapter ID: ${config.id || config.preset}`);
    debugLog(`[lsmcp] Name: ${config.name || config.preset}`);
    debugLog(`[lsmcp] Command: ${config.bin || "N/A"}`);
    debugLog(`[lsmcp] Arguments: ${JSON.stringify(config.args || [])}`);
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
    errorLog(
      `Configuration error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exit(1);
  }
}

// Always run main when this script is executed directly
main().catch((error) => {
  errorLog("Fatal error:", error);
  process.exit(1);
});
