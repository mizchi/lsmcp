/**
 * Doctor command for analyzing environment and suggesting MCP configurations
 */

import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { execSync } from "child_process";
import { PresetRegistry, globalPresetRegistry } from "../config/loader.ts";
import { resolveAdapterCommand } from "../presets/utils.ts";
import type { AdapterConfig } from "../config/schema.ts";
import { registerBuiltinAdapters } from "../config/presets.ts";

export interface DoctorResult {
  projectRoot: string;
  detectedLanguages: DetectedLanguage[];
  availableServers: AvailableServer[];
  mcpConfigurations: McpConfiguration[];
  claudeCodeCommands: string[];
}

export interface DetectedLanguage {
  name: string;
  reason: string;
  files: string[];
  preset?: string;
}

export interface AvailableServer {
  preset: string;
  name: string;
  installed: boolean;
  command?: string;
  installCommand?: string;
}

export interface McpConfiguration {
  preset: string;
  claudeCommand: string;
}

/**
 * Check if a command exists in PATH
 */
function commandExists(command: string): boolean {
  try {
    // Try 'which' for Unix-like systems
    execSync(`which ${command}`, { stdio: "ignore" });
    return true;
  } catch {
    try {
      // Try 'where' for Windows
      execSync(`where ${command}`, { stdio: "ignore" });
      return true;
    } catch {
      // Also check if it's available via npx
      try {
        execSync(`npx --no-install ${command} --version`, {
          stdio: "ignore",
          timeout: 2000,
        });
        return true;
      } catch {
        return false;
      }
    }
  }
}

/**
 * Detect programming languages in the project
 */
async function detectLanguages(
  projectRoot: string,
): Promise<DetectedLanguage[]> {
  const languages: DetectedLanguage[] = [];

  // Check for TypeScript/JavaScript
  if (existsSync(join(projectRoot, "package.json"))) {
    const packageJson = JSON.parse(
      await readFile(join(projectRoot, "package.json"), "utf-8"),
    );

    if (
      packageJson.devDependencies?.typescript ||
      packageJson.dependencies?.typescript
    ) {
      // Prioritize tsgo (faster native TypeScript implementation)
      languages.push({
        name: "TypeScript (tsgo - Recommended)",
        reason: "Fast native TypeScript server",
        files: ["**/*.ts", "**/*.tsx"],
        preset: "tsgo",
      });
      // Also add typescript-language-server as alternative
      languages.push({
        name: "TypeScript (typescript-language-server)",
        reason: "Standard TypeScript language server",
        files: ["**/*.ts", "**/*.tsx"],
        preset: "typescript",
      });
    } else {
      languages.push({
        name: "JavaScript",
        reason: "package.json found",
        files: ["**/*.js", "**/*.jsx"],
        preset: "typescript",
      });
    }
  }

  // Check for Python
  if (
    existsSync(join(projectRoot, "pyproject.toml")) ||
    existsSync(join(projectRoot, "requirements.txt")) ||
    existsSync(join(projectRoot, "setup.py"))
  ) {
    languages.push({
      name: "Python (Pyright)",
      reason: "Python project files found",
      files: ["**/*.py"],
      preset: "pyright",
    });
    // Also add ruff as an alternative Python server
    languages.push({
      name: "Python (Ruff)",
      reason: "Alternative Python linter/formatter",
      files: ["**/*.py"],
      preset: "ruff",
    });
  }

  // Check for Rust
  if (existsSync(join(projectRoot, "Cargo.toml"))) {
    languages.push({
      name: "Rust",
      reason: "Cargo.toml found",
      files: ["**/*.rs"],
      preset: "rust-analyzer",
    });
  }

  // Check for Go
  if (existsSync(join(projectRoot, "go.mod"))) {
    languages.push({
      name: "Go",
      reason: "go.mod found",
      files: ["**/*.go"],
      preset: "gopls",
    });
  }

  // Check for F#
  if (
    existsSync(join(projectRoot, "*.fsproj")) ||
    existsSync(join(projectRoot, "paket.dependencies"))
  ) {
    languages.push({
      name: "F#",
      reason: "F# project files found",
      files: ["**/*.fs", "**/*.fsx", "**/*.fsi"],
      preset: "fsharp",
    });
  }

  // Check for MoonBit
  if (existsSync(join(projectRoot, "moon.mod.json"))) {
    languages.push({
      name: "MoonBit",
      reason: "moon.mod.json found",
      files: ["**/*.mbt"],
      preset: "moonbit",
    });
  }

  return languages;
}

/**
 * Check available language servers
 */
async function checkAvailableServers(
  projectRoot: string,
  languages: DetectedLanguage[],
  adapterRegistry: PresetRegistry,
): Promise<AvailableServer[]> {
  const servers: AvailableServer[] = [];
  const checkedPresets = new Set<string>();

  for (const lang of languages) {
    if (lang.preset && !checkedPresets.has(lang.preset)) {
      checkedPresets.add(lang.preset);

      const adapter = adapterRegistry.get(lang.preset);
      if (adapter) {
        let installed = false;
        let command: string | undefined;

        try {
          // Use binFindStrategy if available
          const resolved = resolveAdapterCommand(
            adapter as AdapterConfig,
            projectRoot,
          );
          command = resolved.command;
          installed = true; // If resolveAdapterCommand succeeds, the command is available
        } catch (error) {
          // Debug: log the error
          if (process.env.DEBUG) {
            console.error(`Failed to resolve ${lang.preset}:`, error);
          }
          // Try direct command check as fallback
          if (adapter.bin) {
            command = adapter.bin;
            installed = commandExists(command);
          } else {
            installed = false;
          }
        }

        // Use more descriptive names for servers
        let serverName = adapter.name || lang.preset;
        if (lang.preset === "tsgo") {
          serverName = "tsgo (Recommended - Fast native TypeScript)";
        } else if (lang.preset === "typescript") {
          serverName = "typescript-language-server";
        } else if (lang.preset === "pyright") {
          serverName = "Pyright";
        } else if (lang.preset === "ruff") {
          serverName = "Ruff LSP";
        }

        const server: AvailableServer = {
          preset: lang.preset,
          name: serverName,
          installed,
          command,
        };

        // Add installation commands
        switch (lang.preset) {
          case "typescript":
            server.installCommand =
              "npm install -g typescript typescript-language-server";
            break;
          case "tsgo":
            server.installCommand = "npm install -g @typescript/native-preview";
            break;
          case "pyright":
            server.installCommand = "npm install -g pyright";
            break;
          case "ruff":
            server.installCommand = "pip install ruff-lsp";
            break;
          case "rust-analyzer":
            server.installCommand = "rustup component add rust-analyzer";
            break;
          case "gopls":
            server.installCommand =
              "go install golang.org/x/tools/gopls@latest";
            break;
          case "fsharp":
            server.installCommand = "dotnet tool install -g fsautocomplete";
            break;
        }

        servers.push(server);
      }
    }
  }

  return servers;
}

/**
 * Generate MCP configurations
 */
function generateMcpConfigurations(
  servers: AvailableServer[],
): McpConfiguration[] {
  const configurations: McpConfiguration[] = [];

  for (const server of servers) {
    if (!server.installed) continue;

    configurations.push({
      preset: server.preset,
      claudeCommand: `claude mcp add lsmcp npx -- -y @mizchi/lsmcp -p ${server.preset}`,
    });
  }

  return configurations;
}

/**
 * Run doctor command
 */
export async function doctorCommand(
  projectRoot: string,
  options?: {
    preset?: string;
    json?: boolean;
  },
): Promise<void> {
  // Use global preset registry and register built-in adapters
  const adapterRegistry = globalPresetRegistry;
  registerBuiltinAdapters(adapterRegistry);

  console.log("🔍 Analyzing project environment...\n");

  // If specific preset requested
  if (options?.preset) {
    const adapter = adapterRegistry.get(options.preset);
    if (!adapter) {
      console.error(`❌ Unknown preset: ${options.preset}`);
      process.exit(1);
    }

    // Check if server is installed
    let installed = false;
    let command: string | undefined;
    try {
      const resolved = resolveAdapterCommand(
        adapter as AdapterConfig,
        projectRoot,
      );
      command = resolved.command;
      installed = true; // If resolveAdapterCommand succeeds, the command is available
    } catch (error) {
      // Try direct command check as fallback
      if (adapter.bin) {
        command = adapter.bin;
        installed = commandExists(command);
      } else {
        installed = false;
      }
    }

    const server: AvailableServer = {
      preset: options.preset,
      name: adapter.name || options.preset,
      installed,
      command,
    };

    // Add installation command
    switch (options.preset) {
      case "typescript":
        server.installCommand =
          "npm install -g typescript typescript-language-server";
        break;
      case "tsgo":
        server.installCommand = "npm install -g @typescript/native-preview";
        break;
      case "pyright":
        server.installCommand = "npm install -g pyright";
        break;
      case "rust-analyzer":
        server.installCommand = "rustup component add rust-analyzer";
        break;
      case "gopls":
        server.installCommand = "go install golang.org/x/tools/gopls@latest";
        break;
    }

    if (!installed) {
      console.log(`❌ ${server.name} is not installed\n`);
      if (server.installCommand) {
        console.log(`To install:\n  ${server.installCommand}\n`);
      }
      process.exit(1);
    }

    console.log(`✅ ${server.name} is installed\n`);
    console.log("📋 Setup Command:");
    console.log(
      `  claude mcp add lsmcp npx -- -y @mizchi/lsmcp -p ${options.preset}\n`,
    );

    return;
  }

  // Detect languages
  const languages = await detectLanguages(projectRoot);

  if (languages.length === 0) {
    console.log("⚠️  No supported languages detected in this project.\n");
    console.log("Supported languages:");
    console.log("  - TypeScript/JavaScript");
    console.log("  - Python");
    console.log("  - Rust");
    console.log("  - Go");
    console.log("  - F#");
    console.log("  - MoonBit\n");
    return;
  }

  console.log("📦 Detected Languages:");
  for (const lang of languages) {
    console.log(`  - ${lang.name}: ${lang.reason}`);
  }
  console.log();

  // Check available servers
  const servers = await checkAvailableServers(
    projectRoot,
    languages,
    adapterRegistry,
  );

  console.log("🔧 Language Servers:");
  for (const server of servers) {
    const status = server.installed ? "✅" : "❌";
    console.log(`  ${status} ${server.name} (${server.preset})`);
    if (!server.installed && server.installCommand) {
      console.log(`      Install: ${server.installCommand}`);
    }
  }
  console.log();

  // Generate configurations for installed servers
  const configurations = generateMcpConfigurations(servers);

  if (configurations.length === 0) {
    console.log("⚠️  No language servers are installed. Install them first:\n");
    for (const server of servers) {
      if (!server.installed && server.installCommand) {
        console.log(`  ${server.installCommand}`);
      }
    }
    return;
  }

  console.log("📋 Setup Commands:\n");

  for (const config of configurations) {
    const server = servers.find((s) => s.preset === config.preset);
    console.log(`  # ${server?.name}`);
    console.log(`  ${config.claudeCommand}\n`);
  }
  console.log();

  // If JSON output requested
  if (options?.json) {
    const result: DoctorResult = {
      projectRoot,
      detectedLanguages: languages,
      availableServers: servers,
      mcpConfigurations: configurations,
      claudeCodeCommands: configurations.map((c) => c.claudeCommand),
    };
    console.log("\n📊 JSON Output:");
    console.log(JSON.stringify(result, null, 2));
  }
}
