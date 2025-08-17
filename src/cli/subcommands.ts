/**
 * Subcommands for lsmcp CLI
 */

import { readFile, writeFile, appendFile, mkdir } from "fs/promises";
import { errorLog } from "../utils/debugLog.ts";
import { join } from "path";
import { existsSync } from "fs";
import type { LSMCPConfig } from "../config/schema.ts";
import {
  ConfigLoader as MainConfigLoader,
  PresetRegistry,
} from "../config/loader.ts";
import { resolveAdapterCommand } from "../presets/utils.ts";
import {
  getOrCreateIndex,
  SymbolIndex,
  NodeFileSystem,
  SQLiteCache,
} from "@internal/code-indexer";
import { glob } from "gitaware-glob";
import {
  detectProjectType,
  generateManualConfigBoilerplate,
} from "../utils/projectDetector.ts";
import {
  createLSPClient,
  createLSPSymbolProvider,
  type LSPClient,
} from "@internal/lsp-client";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

/**
 * Initialize lsmcp project
 */
export async function initCommand(
  projectRoot: string,
  preset?: string,
  adapterRegistry?: PresetRegistry,
  configLoader?: MainConfigLoader,
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
          const id =
            "presetId" in adapter
              ? adapter.presetId
              : (adapter as any).id || "";
          const description =
            (adapter as any).description || (adapter as any).name || "";
          console.log(`  ${id.padEnd(20)} - ${description}`);
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
      errorLog(`❌ Unknown preset: ${preset}`);
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
 * @param projectRoot - Root directory of the project
 * @param isFromInit - Whether this is called from init command
 * @param configLoader - Config loader instance
 * @param adapterRegistry - Adapter registry instance
 * @param forceFullIndex - Force full re-index instead of incremental
 */
export async function indexCommand(
  projectRoot: string,
  isFromInit: boolean = false,
  configLoader?: MainConfigLoader,
  adapterRegistry?: PresetRegistry,
  forceFullIndex: boolean = false,
): Promise<void> {
  const configPath = join(projectRoot, ".lsmcp", "config.json");

  if (!existsSync(configPath)) {
    errorLog("❌ .lsmcp/config.json not found. Run 'lsmcp init' first.");
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
    errorLog(
      "❌ Invalid config.json:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }

  if (!config.files || config.files.length === 0) {
    errorLog("❌ No indexFiles patterns found in config.json");
    process.exit(1);
  }

  console.log("Indexing files...");
  console.log(`Patterns: ${config.files.join(", ")}`);

  // Find all files matching patterns
  const allFiles: string[] = [];
  for (const pattern of config.files) {
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

  if (config.preset && configLoader && adapterRegistry) {
    try {
      // Load preset configuration
      const presetConfig = adapterRegistry.get(config.preset);
      if (!presetConfig) {
        throw new Error(`Unknown preset: ${config.preset}`);
      }
      const adapterConfig = presetConfig;

      console.log(
        `Starting ${adapterConfig.name || adapterConfig.presetId} for indexing...`,
      );

      // Resolve the command using binFinder if needed
      const { command, args } = resolveAdapterCommand(
        adapterConfig,
        projectRoot,
      );

      // Check if command exists before spawning
      const { execSync } = await import("child_process");
      try {
        execSync(`which ${command}`, { stdio: "ignore" });
      } catch {
        throw new Error(`Command not found: ${command}`);
      }

      // Spawn LSP process
      const lspProcess = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: projectRoot,
      });

      // Handle spawn errors
      lspProcess.on("error", (error: Error) => {
        errorLog(`Failed to start ${command}: ${error.message}`);
        if (error.message.includes("ENOENT")) {
          errorLog(`Make sure ${adapterConfig.bin} is installed and in PATH`);
          if (adapterConfig.presetId === "tsgo") {
            errorLog("Install with: npm install -g @typescript/native-preview");
          } else if (adapterConfig.presetId === "typescript") {
            errorLog(
              "Install with: npm install -g typescript typescript-language-server",
            );
          } else if (adapterConfig.presetId === "rust-analyzer") {
            errorLog(
              "Install rust-analyzer from: https://rust-analyzer.github.io/",
            );
          }
        }
      });

      // Create LSP client
      lspClient = createLSPClient({
        process: lspProcess,
        rootPath: projectRoot,
        languageId: adapterConfig.baseLanguage || adapterConfig.presetId,
        initializationOptions: adapterConfig.initializationOptions as
          | Record<string, unknown>
          | undefined,
        serverCharacteristics: (adapterConfig as any).serverCharacteristics,
      });

      // Start LSP server
      await lspClient?.start();

      // Create file content provider
      const fileContentProvider = async (uri: string): Promise<string> => {
        const path = fileURLToPath(uri);
        return await readFile(path, "utf-8");
      };

      // Create symbol provider
      const symbolProvider = lspClient
        ? createLSPSymbolProvider(lspClient, fileContentProvider)
        : null;

      // Create file system and cache
      const fileSystem = new NodeFileSystem();
      const cache = new SQLiteCache(projectRoot);

      // Create symbol index with all components
      if (symbolProvider) {
        index = new SymbolIndex(projectRoot, symbolProvider, fileSystem, cache);

        // Load existing index from cache if available
        await index.initialize();
      }
    } catch (error) {
      errorLog(
        `Failed to start LSP server: ${error instanceof Error ? error.message : String(error)}`,
      );

      // Provide installation instructions based on the adapter
      if (
        error instanceof Error &&
        error.message.includes("Command not found")
      ) {
        if (config.preset === "tsgo") {
          errorLog("\nTo install tsgo:");
          errorLog("  npm install -g @typescript/native-preview");
          errorLog("\nAlternatively, you can use a different preset:");
          errorLog("  lsmcp init -p typescript");
        } else if (config.preset === "typescript") {
          errorLog("\nTo install typescript-language-server:");
          errorLog("  npm install -g typescript typescript-language-server");
        } else if (config.preset === "rust-analyzer") {
          errorLog("\nTo install rust-analyzer:");
          errorLog("  Visit: https://rust-analyzer.github.io/");
        } else if (config.preset === "pyright") {
          errorLog("\nTo install pyright:");
          errorLog("  npm install -g pyright");
        } else if (config.preset === "gopls") {
          errorLog("\nTo install gopls:");
          errorLog("  go install golang.org/x/tools/gopls@latest");
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
    const maybeIndex = getOrCreateIndex(projectRoot, null);
    index = maybeIndex !== null ? maybeIndex : undefined;
  }

  if (!index) {
    if (isFromInit) {
      console.log("\n⚠️  Symbol indexing skipped (LSP not available).");
      console.log("   You can run 'lsmcp index' later to build the index.");
      return;
    } else {
      errorLog("❌ Failed to create symbol index. Make sure LSP is available.");
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
    updated?: string[];
    removed?: string[];
    mode?: string;
  };

  try {
    // Load cache first to get accurate stats
    await index.loadIndexFromCache();

    // Check if we should do incremental update
    const stats = index.getStats();
    const hasExistingIndex = stats.totalFiles > 0;

    if (!forceFullIndex && hasExistingIndex) {
      // Try incremental update
      console.log("Performing incremental update...");

      const incrementalResult = await index.updateIncremental({
        batchSize: config.settings?.indexConcurrency || 5,
      });

      // Get updated stats
      const updatedStats = index.getStats();

      result = {
        success: true,
        totalFiles: updatedStats.totalFiles,
        totalSymbols: updatedStats.totalSymbols,
        errors: incrementalResult.errors.map((err) => ({
          file: "incremental",
          error: err,
        })),
        updated: incrementalResult.updated,
        removed: incrementalResult.removed,
        mode: "incremental",
      };
    } else if (!forceFullIndex) {
      // Check for cached data before full index
      const cache = new SQLiteCache(projectRoot);
      const cachedFiles = await cache.getAllFiles();

      if (cachedFiles.length > 0) {
        console.log(
          `Found ${cachedFiles.length} files in cache. Checking for changes...`,
        );

        // Perform early diff detection
        const filesToUpdate: string[] = [];
        const { statSync } = await import("fs");

        for (const file of uniqueFiles) {
          try {
            const absolutePath = join(projectRoot, file);
            const stats = statSync(absolutePath);
            const cacheInfo = await cache.getFileInfo(absolutePath);

            if (!cacheInfo || stats.mtimeMs > cacheInfo.lastModified) {
              filesToUpdate.push(file);
            }
          } catch {
            // File doesn't exist or can't be read, add to update list
            filesToUpdate.push(file);
          }
        }

        // Find removed files
        const currentFileSet = new Set(
          uniqueFiles.map((f) => join(projectRoot, f)),
        );
        const removedFiles = cachedFiles.filter((f) => !currentFileSet.has(f));

        if (filesToUpdate.length > 0 || removedFiles.length > 0) {
          console.log(
            `Detected ${filesToUpdate.length} files to update, ${removedFiles.length} files to remove`,
          );

          // Update only changed files
          if (filesToUpdate.length > 0) {
            await index.indexFiles(
              filesToUpdate,
              config.settings?.indexConcurrency || 5,
            );
          }

          // Remove deleted files from index
          for (const removedFile of removedFiles) {
            const relativePath = removedFile.startsWith(projectRoot)
              ? removedFile.slice(projectRoot.length + 1)
              : removedFile;
            index.removeFile(relativePath);
          }

          const updatedStats = index.getStats();

          result = {
            success: true,
            totalFiles: updatedStats.totalFiles,
            totalSymbols: updatedStats.totalSymbols,
            errors: [],
            updated: filesToUpdate,
            removed: removedFiles.map((f) =>
              f.startsWith(projectRoot) ? f.slice(projectRoot.length + 1) : f,
            ),
            mode: "smart-incremental",
          };
        } else {
          console.log("No changes detected. Index is up to date.");
          const updatedStats = index.getStats();

          result = {
            success: true,
            totalFiles: updatedStats.totalFiles,
            totalSymbols: updatedStats.totalSymbols,
            errors: [],
            updated: [],
            removed: [],
            mode: "no-changes",
          };
        }
      } else {
        // No cache, perform full index
        console.log("No existing cache found. Performing full index...");

        await index.indexFiles(
          uniqueFiles,
          config.settings?.indexConcurrency || 5,
        );

        // Get stats
        const stats = index.getStats();

        result = {
          success: true,
          totalFiles: stats.totalFiles,
          totalSymbols: stats.totalSymbols,
          errors: [],
          mode: "full",
        };
      }
    } else {
      // Full index with --full flag
      console.log("Performing full re-index (--full flag)...");

      await index.indexFiles(
        uniqueFiles,
        config.settings?.indexConcurrency || 5,
      );

      // Get stats
      const stats = index.getStats();

      result = {
        success: true,
        totalFiles: stats.totalFiles,
        totalSymbols: stats.totalSymbols,
        errors: [],
        mode: "full",
      };
    }
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
    if (result.mode === "incremental") {
      console.log(`\n✅ Incremental update complete in ${duration}ms`);
      if (result.updated && result.updated.length > 0) {
        console.log(`   Updated files: ${result.updated.length}`);
      }
      if (result.removed && result.removed.length > 0) {
        console.log(`   Removed files: ${result.removed.length}`);
      }
    } else if (result.mode === "smart-incremental") {
      console.log(`\n✅ Smart incremental update complete in ${duration}ms`);
      if (result.updated && result.updated.length > 0) {
        console.log(`   Updated files: ${result.updated.length}`);
      }
      if (result.removed && result.removed.length > 0) {
        console.log(`   Removed files: ${result.removed.length}`);
      }
    } else if (result.mode === "no-changes") {
      console.log(`\n✅ Index is up to date (checked in ${duration}ms)`);
    } else {
      console.log(`\n✅ Full indexing complete in ${duration}ms`);
    }
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
    errorLog("\n❌ Indexing failed");
    result.errors.forEach((err) => {
      errorLog(`   ${err.file}: ${err.error}`);
    });
  }

  // Cleanup LSP client if we started one
  if (lspClient) {
    try {
      await lspClient.stop();
      console.log("\n✓ LSP server stopped");
    } catch (error) {
      errorLog(
        `Failed to stop LSP server: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
