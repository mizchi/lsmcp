/**
 * Subcommands for lsmcp CLI
 */

import { readFile, writeFile, appendFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import {
  type LSMCPConfig,
  DEFAULT_CONFIG,
  validateConfig,
  createConfigFromAdapter,
} from "../core/config/lsmcpConfig.ts";
import type { AdapterRegistry } from "../core/config/configLoader.ts";
import {
  getOrCreateIndex,
  indexFiles as indexFilesAdapter,
} from "../indexer/mcp/IndexerAdapter.ts";
import { glob } from "glob";

/**
 * Initialize lsmcp project
 */
export async function initCommand(
  projectRoot: string,
  preset?: string,
  adapterRegistry?: AdapterRegistry,
): Promise<void> {
  console.log("Initializing lsmcp project...");

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
  let config: LSMCPConfig;

  // If preset is provided, expand adapter configuration
  if (preset && adapterRegistry) {
    const adapter = adapterRegistry.get(preset);
    if (!adapter) {
      console.error(`❌ Unknown preset: ${preset}`);
      process.exit(1);
    }

    // Set appropriate index patterns based on language
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

    config = createConfigFromAdapter(adapter, indexPatterns);
  } else {
    config = { ...DEFAULT_CONFIG };
  }

  await writeFile(configPath, JSON.stringify(config, null, 2));
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
  console.log("\nNext steps:");
  console.log("1. Review and adjust .lsmcp/config.json if needed");
  console.log("2. Run 'lsmcp index' to build the symbol index");
}

/**
 * Index files based on config
 */
export async function indexCommand(projectRoot: string): Promise<void> {
  const configPath = join(projectRoot, ".lsmcp", "config.json");

  if (!existsSync(configPath)) {
    console.error("❌ .lsmcp/config.json not found. Run 'lsmcp init' first.");
    process.exit(1);
  }

  // Load and validate config
  const configContent = await readFile(configPath, "utf-8");
  let config: LSMCPConfig;
  try {
    config = validateConfig(JSON.parse(configContent));
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
    const files = await glob(pattern, {
      cwd: projectRoot,
      ignore: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.git/**",
        "**/target/**",
        "**/bin/**",
        "**/obj/**",
      ],
    });
    allFiles.push(...files);
  }

  // Remove duplicates
  const uniqueFiles = [...new Set(allFiles)];

  if (uniqueFiles.length === 0) {
    console.log("No files found matching the patterns.");
    return;
  }

  console.log(`Found ${uniqueFiles.length} files to index`);

  // Create index
  const index = getOrCreateIndex(projectRoot);
  if (!index) {
    console.error(
      "❌ Failed to create symbol index. Make sure LSP is available.",
    );
    process.exit(1);
  }

  // Index files
  const startTime = Date.now();
  const result = await indexFilesAdapter(projectRoot, uniqueFiles, {
    concurrency: config.settings?.indexConcurrency || 5,
  });

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
}
