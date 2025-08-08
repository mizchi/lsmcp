/**
 * Subcommands for lsmcp CLI
 */

import { readFile, writeFile, appendFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import type { LSMCPConfig } from "../config/schema/configSchema.ts";
import { ConfigLoader as MainConfigLoader } from "../config/loader/loader.ts";
import type {
  AdapterRegistry,
  ConfigLoader,
} from "../config/loader/configLoader.ts";
import { getOrCreateIndex } from "../indexer/mcp/IndexerAdapter.ts";
import { glob } from "gitaware-glob";
import {
  detectProjectType,
  generateManualConfigBoilerplate,
} from "./projectDetector.ts";
import { createLSPClient, type LSPClient } from "../lsp/lspClient.ts";
import { spawn } from "child_process";
import { SymbolIndex } from "../indexer/engine/SymbolIndex.ts";
import { LSPSymbolProvider } from "../indexer/lsp/LSPSymbolProvider.ts";
import { NodeFileSystem } from "../indexer/engine/NodeFileSystem.ts";
import { SQLiteCache } from "../indexer/cache/SQLiteCache.ts";
import { fileURLToPath } from "url";

/**
 * Initialize lsmcp project
 */
export async function initCommand(
  projectRoot: string,
  preset?: string,
  adapterRegistry?: AdapterRegistry,
  configLoader?: ConfigLoader,
  autoIndex?: boolean,
): Promise<void> {
  console.log("Initializing lsmcp project...");

  // Auto-detect project type if no preset specified
  if (!preset && adapterRegistry) {
    console.log("\nDetecting project type...");
    const detected = await detectProjectType(projectRoot);

    if (detected.length === 0) {
      console.log("\n❌ Could not detect project type.");
      console.log(
        "\nPlease specify a preset with -p option, or create a custom config.",
      );
      console.log("\nAvailable presets:");
      adapterRegistry
        .list()
        .slice(0, 5)
        .forEach((adapter) => {
          console.log(
            `  ${adapter.id.padEnd(20)} - ${adapter.description || adapter.name}`,
          );
        });
      console.log("\nFor a complete list: lsmcp --list");
      console.log(
        "\nAlternatively, we'll create a boilerplate config for manual setup.",
      );

      // Ask user if they want to create boilerplate
      const readline = await import("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question("\nCreate boilerplate config? (y/N): ", resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== "y") {
        console.log("\nInitialization cancelled.");
        process.exit(0);
      }

      // Continue with boilerplate creation below
    } else if (detected.length === 1) {
      // Single match - use it
      preset = detected[0].preset;
      console.log(
        `\n✓ Detected ${detected[0].preset} project: ${detected[0].reason}`,
      );
      console.log(`  Using preset: ${preset}`);
    } else {
      // Multiple matches - ask user to choose
      console.log("\n⚠️  Multiple project types detected:");
      detected.forEach((d, i) => {
        console.log(`  ${i + 1}. ${d.preset.padEnd(15)} - ${d.reason}`);
      });

      const readline = await import("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question(
          `\nSelect preset (1-${detected.length}) or press Enter for manual config: `,
          resolve,
        );
      });
      rl.close();

      const selection = parseInt(answer);
      if (selection >= 1 && selection <= detected.length) {
        preset = detected[selection - 1].preset;
        console.log(`\nUsing preset: ${preset}`);
      } else {
        console.log("\nCreating boilerplate config for manual setup...");
      }
    }
  }

  // 1. Create .lsmcp directory
  const lsmcpDir = join(projectRoot, ".lsmcp");
  if (!existsSync(lsmcpDir)) {
    await mkdir(lsmcpDir, { recursive: true });
    console.log("✓ Created .lsmcp directory");
  }

  // 2. Update .gitignore
  const gitignorePath = join(projectRoot, ".gitignore");
  let gitignoreContent = "";
  if (existsSync(gitignorePath)) {
    gitignoreContent = await readFile(gitignorePath, "utf-8");
  }

  if (!gitignoreContent.includes(".lsmcp/cache")) {
    await appendFile(gitignorePath, "\n# lsmcp cache\n.lsmcp/cache\n");
    console.log("✓ Updated .gitignore");
  }

  // 3. Create config.json
  const configPath = join(lsmcpDir, "config.json");
  let configContent: any;

  // If preset is provided, create minimal config with preset field
  if (preset && adapterRegistry) {
    const adapter = adapterRegistry.get(preset);
    if (!adapter) {
      console.error(`❌ Unknown preset: ${preset}`);
      process.exit(1);
    }

    // Create minimal config with just preset
    configContent = {
      preset: preset,
    };

    // Set appropriate index patterns based on language if needed
    let indexPatterns: string[] | undefined;
    switch (preset) {
      case "pyright":
      case "ruff":
        indexPatterns = ["**/*.py"];
        break;
      case "rust-analyzer":
        indexPatterns = ["**/*.rs"];
        break;
      case "gopls":
        indexPatterns = ["**/*.go"];
        break;
      case "fsharp":
        indexPatterns = ["**/*.fs", "**/*.fsx", "**/*.fsi"];
        break;
      case "moonbit":
        indexPatterns = ["**/*.mbt"];
        break;
      default:
        // Keep default TypeScript/JavaScript patterns
        break;
    }

    if (indexPatterns) {
      configContent.indexFiles = indexPatterns;
    }
  } else {
    // No preset - create boilerplate config
    const boilerplate = generateManualConfigBoilerplate();
    configContent = JSON.parse(boilerplate);
  }

  await writeFile(configPath, JSON.stringify(configContent, null, 2));
  console.log("✓ Created .lsmcp/config.json");

  // 4. Check for CLAUDE.md
  const claudeMdPath = join(projectRoot, "CLAUDE.md");
  if (!existsSync(claudeMdPath)) {
    console.log(
      "\n⚠️  CLAUDE.md not found. Consider creating one with project-specific instructions.",
    );
  } else {
    // Check if system prompt is already included
    const claudeContent = await readFile(claudeMdPath, "utf-8");

    if (!claudeContent.includes("professional coding agent")) {
      console.log(
        "\nℹ️  Consider adding the following system prompt to the beginning of CLAUDE.md:",
      );
      console.log("   (from src/prompts/system.ts)");
      console.log(
        "\n   This helps AI agents understand how to use the semantic coding tools effectively.",
      );
    }
  }

  console.log("\n✅ Initialization complete!");

  // Show additional message for manual config
  if (!preset || configContent.adapter?.id === "custom") {
    console.log("\n⚠️  Manual configuration required!");
    console.log(
      "   Please edit .lsmcp/config.json to configure your language server:",
    );
    console.log("   - Set 'bin' to your language server command");
    console.log("   - Adjust 'indexFiles' patterns for your language");
    console.log("   - Configure any necessary 'initializationOptions'");
    console.log(
      "\nAfter configuration, run 'lsmcp index' to build the symbol index.",
    );
  } else if (autoIndex) {
    // Auto-build index only when --auto-index is specified
    console.log("\nBuilding symbol index...");
    await indexCommand(projectRoot, true, configLoader, adapterRegistry);
  } else {
    console.log("\nTo build the symbol index, run: lsmcp index");
  }
}

/**
 * Index files based on config
 */
export async function indexCommand(
  projectRoot: string,
  isFromInit: boolean = false,
  configLoader?: ConfigLoader,
  adapterRegistry?: AdapterRegistry,
): Promise<void> {
  const configPath = join(projectRoot, ".lsmcp", "config.json");

  if (!existsSync(configPath)) {
    console.error("❌ .lsmcp/config.json not found. Run 'lsmcp init' first.");
    process.exit(1);
  }

  // Load and validate config using new ConfigLoader
  const mainConfigLoader = new MainConfigLoader(projectRoot);
  let config: LSMCPConfig;
  try {
    const result = await mainConfigLoader.load({
      configFile: ".lsmcp/config.json",
    });
    config = result.config;
  } catch (error) {
    console.error(
      "❌ Invalid config.json:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }

  if (!config.indexFiles || config.indexFiles.length === 0) {
    console.error("❌ No indexFiles patterns found in config.json");
    process.exit(1);
  }

  console.log("Indexing files...");
  console.log(`Patterns: ${config.indexFiles.join(", ")}`);

  // Find all files matching patterns
  const allFiles: string[] = [];
  for (const pattern of config.indexFiles) {
    const filesGen = await glob(pattern, {
      cwd: projectRoot,
    });
    for await (const file of filesGen) {
      allFiles.push(file);
    }
  }

  // Remove duplicates
  const uniqueFiles = [...new Set(allFiles)];

  if (uniqueFiles.length === 0) {
    console.log("No files found matching the patterns.");
    if (!isFromInit) {
      console.log(
        "\nTip: Check your indexFiles patterns in .lsmcp/config.json",
      );
    }
    return;
  }

  console.log(`Found ${uniqueFiles.length} files to index`);

  // If adapter config exists, start LSP server for indexing
  let lspClient: LSPClient | undefined;
  let index: SymbolIndex | undefined;

  if (config.adapter && configLoader && adapterRegistry) {
    try {
      // Load adapter configuration
      const adapter = config.adapter;
      const adapterConfig = adapterRegistry.get(adapter.id) || adapter;

      console.log(`Starting ${adapterConfig.name} for indexing...`);

      // Check if command exists before spawning
      const { execSync } = await import("child_process");
      try {
        execSync(`which ${adapterConfig.bin}`, { stdio: "ignore" });
      } catch {
        throw new Error(`Command not found: ${adapterConfig.bin}`);
      }

      // Spawn LSP process
      const lspProcess = spawn(adapterConfig.bin, adapterConfig.args || [], {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: projectRoot,
      });

      // Handle spawn errors
      lspProcess.on("error", (error) => {
        console.error(`Failed to start ${adapterConfig.bin}: ${error.message}`);
        if (error.message.includes("ENOENT")) {
          console.error(
            `Make sure ${adapterConfig.bin} is installed and in PATH`,
          );
          if (adapterConfig.id === "tsgo") {
            console.error(
              "Install with: npm install -g @typescript/native-preview",
            );
          } else if (adapterConfig.id === "typescript") {
            console.error(
              "Install with: npm install -g typescript typescript-language-server",
            );
          } else if (adapterConfig.id === "rust-analyzer") {
            console.error(
              "Install rust-analyzer from: https://rust-analyzer.github.io/",
            );
          }
        }
      });

      // Create LSP client
      lspClient = createLSPClient({
        process: lspProcess,
        rootPath: projectRoot,
        languageId: adapterConfig.baseLanguage,
        initializationOptions: adapterConfig.initializationOptions,
        serverCharacteristics: (adapterConfig as any).serverCharacteristics,
      });

      // Start LSP server
      await lspClient.start();

      // Create file content provider
      const fileContentProvider = async (uri: string): Promise<string> => {
        const path = fileURLToPath(uri);
        return await readFile(path, "utf-8");
      };

      // Create symbol provider
      const symbolProvider = new LSPSymbolProvider(
        lspClient,
        fileContentProvider,
      );

      // Create file system and cache
      const fileSystem = new NodeFileSystem();
      const cache = new SQLiteCache(projectRoot);

      // Create symbol index with all components
      index = new SymbolIndex(projectRoot, symbolProvider, fileSystem, cache);
    } catch (error) {
      console.error(
        `Failed to start LSP server: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Provide installation instructions based on the adapter
      if (
        error instanceof Error &&
        error.message.includes("Command not found")
      ) {
        if (config.adapter?.id === "tsgo") {
          console.error("\nTo install tsgo:");
          console.error("  npm install -g @typescript/native-preview");
          console.error("\nAlternatively, you can use a different preset:");
          console.error("  lsmcp init -p typescript");
        } else if (config.adapter?.id === "typescript") {
          console.error("\nTo install typescript-language-server:");
          console.error(
            "  npm install -g typescript typescript-language-server",
          );
        } else if (config.adapter?.id === "rust-analyzer") {
          console.error("\nTo install rust-analyzer:");
          console.error("  Visit: https://rust-analyzer.github.io/");
        } else if (config.adapter?.id === "pyright") {
          console.error("\nTo install pyright:");
          console.error("  npm install -g pyright");
        } else if (config.adapter?.id === "gopls") {
          console.error("\nTo install gopls:");
          console.error("  go install golang.org/x/tools/gopls@latest");
        }
      }

      if (isFromInit) {
        console.log("\n⚠️  Symbol indexing skipped (LSP not available).");
        console.log("   You can run 'lsmcp index' later to build the index.");
        return;
      } else {
        process.exit(1);
      }
    }
  } else {
    // Fallback to existing index (for backward compatibility)
    const maybeIndex = getOrCreateIndex(projectRoot);
    index = maybeIndex !== null ? maybeIndex : undefined;
  }

  if (!index) {
    if (isFromInit) {
      console.log("\n⚠️  Symbol indexing skipped (LSP not available).");
      console.log("   You can run 'lsmcp index' later to build the index.");
      return;
    } else {
      console.error(
        "❌ Failed to create symbol index. Make sure LSP is available.",
      );
      process.exit(1);
    }
  }

  // Index files
  const startTime = Date.now();
  let result: {
    success: boolean;
    totalFiles: number;
    totalSymbols: number;
    errors: Array<{ file: string; error: string }>;
  };

  try {
    // Index files directly using the index instance
    await index.indexFiles(uniqueFiles, config.settings?.indexConcurrency || 5);

    // Get stats
    const stats = index.getStats();

    result = {
      success: true,
      totalFiles: stats.totalFiles,
      totalSymbols: stats.totalSymbols,
      errors: [],
    };
  } catch (error) {
    result = {
      success: false,
      totalFiles: 0,
      totalSymbols: 0,
      errors: [
        {
          file: "index",
          error: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }

  const duration = Date.now() - startTime;

  if (result.success) {
    console.log(`\n✅ Indexing complete in ${duration}ms`);
    console.log(`   Total files: ${result.totalFiles}`);
    console.log(`   Total symbols: ${result.totalSymbols}`);

    if (result.errors.length > 0) {
      console.log(`\n⚠️  ${result.errors.length} files had errors:`);
      result.errors.slice(0, 5).forEach((err) => {
        console.log(`   - ${err.file}: ${err.error}`);
      });
      if (result.errors.length > 5) {
        console.log(`   ... and ${result.errors.length - 5} more`);
      }
    }
  } else {
    console.error("\n❌ Indexing failed");
    result.errors.forEach((err) => {
      console.error(`   ${err.file}: ${err.error}`);
    });
  }

  // Cleanup LSP client if we started one
  if (lspClient) {
    try {
      await lspClient.stop();
      console.log("\n✓ LSP server stopped");
    } catch (error) {
      console.error(
        `Failed to stop LSP server: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
