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
import { parseFilePatterns } from "../utils/filePatternParser.ts";

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
    "list-tools": {
      type: "boolean",
      description: "List available MCP tools for the current configuration",
    },
    disable: {
      type: "string",
      description: "Comma-separated list of tools to disable",
    },
    "auto-index": {
      type: "boolean",
      description: "Automatically build symbol index after init",
    },
    full: {
      type: "boolean",
      description:
        "Force full re-index instead of incremental update (for 'index' command)",
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
    await indexCommand(
      process.cwd(),
      false,
      lspConfigLoader,
      adapterRegistry,
      values.full,
    );
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

  // List tools if requested
  if (values["list-tools"]) {
    await listTools(values.preset, values.disable);
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
          '  lsmcp --files "**/*.ts,**/*.tsx"       # Specify file patterns (comma-separated)',
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
        files: parseFilePatterns(values.files),
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
      lspSources.config.files = parseFilePatterns(values.files);
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

/**
 * List available MCP tools based on configuration
 */
async function listTools(presetName?: string, disableList?: string) {
  console.log("\n🛠️  Available MCP Tools\n");

  // Parse disable list
  const disabledTools = disableList
    ? disableList.split(",").map((t) => t.trim())
    : [];

  try {
    // If no preset specified, try to load from config file
    let config: any = null;

    if (!presetName) {
      // Check for .lsmcp/config.json
      const configPath = join(process.cwd(), ".lsmcp", "config.json");
      if (existsSync(configPath)) {
        const result = await lspConfigLoader.load({ configFile: configPath });
        config = result.config;
        console.log(`Loading tools from: ${configPath}\n`);
      } else {
        // No preset and no config - show all tools
        console.log("No preset specified. Showing all available tools.\n");
        console.log(
          "To see preset-specific tools, use: lsmcp --list-tools -p <preset>\n",
        );
      }
    } else {
      // Load preset configuration
      const result = await lspConfigLoader.load({ preset: presetName });
      config = result.config;
      console.log(`Preset: ${presetName}\n`);
    }

    // Import tool lists
    const { getAllAvailableTools } = await import("../tools/getAllTools.ts");
    const { filterUnsupportedTools } = await import("../utils/toolFilters.ts");

    // Get all available tools
    const allTools = await getAllAvailableTools(config);

    // Apply filtering based on preset's disable list and user's disable list
    let filteredTools = allTools;

    // Apply preset's disable list
    if (config?.disable && config.disable.length > 0) {
      filteredTools = filterUnsupportedTools(filteredTools, config.disable);
      console.log(`Preset disabled tools: ${config.disable.join(", ")}\n`);
    }

    // Apply user's disable list
    if (disabledTools.length > 0) {
      filteredTools = filterUnsupportedTools(filteredTools, disabledTools);
      console.log(`User disabled tools: ${disabledTools.join(", ")}\n`);
    }

    // If preset has capabilities, filter by them
    if (presetName && config) {
      // Try to get capabilities for the preset
      try {
        const { getCapabilitiesForPreset } = await import(
          "../utils/capabilityChecker.ts"
        );
        const capabilities = await getCapabilitiesForPreset(config);

        if (capabilities) {
          const { filterToolsByCapabilities } = await import(
            "../utils/toolFilters.ts"
          );
          const beforeCount = filteredTools.length;
          filteredTools = filterToolsByCapabilities(
            filteredTools,
            capabilities,
          );
          const removedCount = beforeCount - filteredTools.length;

          if (removedCount > 0) {
            console.log(
              `Filtered ${removedCount} tools based on LSP capabilities\n`,
            );
          }
        }
      } catch (error) {
        // Capabilities check failed - continue without filtering
        debugLog(`Failed to get capabilities: ${error}`);
      }
    }

    // Group tools by category with ordered display
    const categoryOrder = [
      // High-level tools first
      "Project Overview",
      "Memory System",
      "Symbol Search & Indexing",
      "File System",
      "Code Editing",
      // LSP tools second
      "LSP: Code Navigation",
      "LSP: Diagnostics",
      "LSP: Code Actions",
      "LSP: Code Intelligence",
      "LSP: Capabilities",
      // Other
      "Other",
    ];

    const categories: Record<string, typeof filteredTools> = {};
    for (const cat of categoryOrder) {
      categories[cat] = [];
    }

    // Categorize tools - high-level tools first, then LSP tools
    for (const tool of filteredTools) {
      const name = tool.name;

      // High-level tools
      if (name.includes("project_overview")) {
        categories["Project Overview"].push(tool);
      } else if (name.includes("memory") || name === "index_onboarding") {
        categories["Memory System"].push(tool);
      } else if (
        name === "search_symbols" ||
        name.includes("index_symbols") ||
        name.includes("clear_index") ||
        name.includes("search_symbol") ||
        name.includes("get_symbols_overview") ||
        name.includes("find_file") ||
        name === "index_files" ||
        name === "query_symbols"
      ) {
        categories["Symbol Search & Indexing"].push(tool);
      } else if (name === "list_dir") {
        categories["File System"].push(tool);
      } else if (
        name === "replace_range" ||
        name === "replace_regex" ||
        (name.includes("replace") && !name.includes("lsp")) ||
        (name.includes("insert") && !name.includes("lsp"))
      ) {
        categories["Code Editing"].push(tool);
      }
      // LSP tools
      else if (
        name.includes("lsp_find_references") ||
        name.includes("lsp_get_definitions") ||
        name.includes("lsp_get_hover") ||
        name.includes("lsp_get_document_symbols") ||
        name.includes("lsp_get_workspace_symbols")
      ) {
        categories["LSP: Code Navigation"].push(tool);
      } else if (name.includes("lsp_get_diagnostics")) {
        categories["LSP: Diagnostics"].push(tool);
      } else if (
        name.includes("lsp_rename") ||
        name.includes("lsp_delete") ||
        name.includes("lsp_format") ||
        name.includes("lsp_get_code_actions")
      ) {
        categories["LSP: Code Actions"].push(tool);
      } else if (
        name.includes("lsp_get_completion") ||
        name.includes("lsp_get_signature")
      ) {
        categories["LSP: Code Intelligence"].push(tool);
      } else if (name === "lsp_check_capabilities") {
        categories["LSP: Capabilities"].push(tool);
      } else {
        categories["Other"].push(tool);
      }
    }

    // Display tools by category in the defined order
    let totalTools = 0;
    for (const category of categoryOrder) {
      const tools = categories[category];
      if (!tools || tools.length === 0) continue;

      console.log(`${category}:`);
      for (const tool of tools) {
        const description = tool.description
          ? tool.description.split("\n")[0].substring(0, 70) +
            (tool.description.length > 70 ? "..." : "")
          : "";
        console.log(`  • ${tool.name}`);
        if (description) {
          console.log(`    ${description}`);
        }
      }
      console.log();
      totalTools += tools.length;
    }

    console.log(`Total: ${totalTools} tools available`);

    // Show disabled tools count
    const disabledCount = allTools.length - filteredTools.length;
    if (disabledCount > 0) {
      console.log(`(${disabledCount} tools disabled or filtered)\n`);
    }
  } catch (error) {
    errorLog(
      `Error listing tools: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

// Always run main when this script is executed directly
main().catch((error) => {
  errorLog("Fatal error:", error);
  process.exit(1);
});
