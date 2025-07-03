/**
 * Configuration loader with priority order:
 * 1. --preset(-p) - predefined language adapters
 * 2. --config - JSON configuration file
 * 3. CLI arguments - override specific fields like --bin
 */

import { readFile } from "fs/promises";
import type { LspAdapter } from "../../types.ts";

/**
 * Runtime configuration after resolving all sources
 */
export interface ResolvedConfig {
  id: string;
  name: string;
  bin: string; // Simplified from lspCommand
  args: string[]; // Simplified from lspArgs
  baseLanguage?: string;
  description?: string;
  unsupported?: string[];
  initializationOptions?: unknown;
}

/**
 * CLI arguments that can override configuration
 */
export interface ConfigOverrides {
  bin?: string;
  args?: string[];
  initializationOptions?: unknown;
}

/**
 * Configuration sources in priority order
 */
export interface ConfigSources {
  preset?: string;
  configFile?: string;
  overrides?: ConfigOverrides;
}

/**
 * Predefined adapters registry
 */
export class AdapterRegistry {
  private adapters = new Map<string, LspAdapter>();

  register(adapter: LspAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): LspAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): LspAdapter[] {
    return Array.from(this.adapters.values());
  }

  has(id: string): boolean {
    return this.adapters.has(id);
  }
}

/**
 * Main configuration loader
 */
export class ConfigLoader {
  constructor(private registry: AdapterRegistry) {}

  /**
   * Load and resolve configuration from multiple sources
   */
  async loadConfig(sources: ConfigSources): Promise<ResolvedConfig> {
    let baseConfig: Partial<ResolvedConfig> | undefined;

    // 1. Load from preset (highest priority base)
    if (sources.preset) {
      const adapter = this.registry.get(sources.preset);
      if (!adapter) {
        throw new Error(`Unknown preset: ${sources.preset}`);
      }
      baseConfig = this.adapterToConfig(adapter);
    }

    // 2. Load from config file (overrides preset)
    if (sources.configFile) {
      const fileConfig = await this.loadConfigFile(sources.configFile);
      if (baseConfig) {
        // Merge configs, but only override defined fields
        baseConfig = {
          ...baseConfig,
          ...Object.fromEntries(
            Object.entries(fileConfig).filter(
              ([_, value]) => value !== undefined,
            ),
          ),
        };
      } else {
        baseConfig = fileConfig;
      }
    }

    // 3. Apply CLI overrides (highest priority)
    if (sources.overrides) {
      if (baseConfig) {
        baseConfig = this.applyOverrides(baseConfig, sources.overrides);
      } else {
        // If no base config, create minimal config from overrides
        if (!sources.overrides.bin) {
          throw new Error(
            "No configuration source provided. Use --preset, --config, or --bin",
          );
        }
        baseConfig = {
          id: "custom",
          name: "Custom LSP",
          bin: sources.overrides.bin,
          args: sources.overrides.args || [],
          initializationOptions: sources.overrides.initializationOptions,
        };
      }
    }

    if (!baseConfig) {
      throw new Error("No configuration source provided");
    }

    // Validate required fields
    if (!baseConfig.id || !baseConfig.name || !baseConfig.bin) {
      throw new Error(
        "Invalid configuration: missing required fields (id, name, bin)",
      );
    }

    return baseConfig as ResolvedConfig;
  }

  /**
   * Convert LspAdapter to ResolvedConfig format
   */
  private adapterToConfig(adapter: LspAdapter): ResolvedConfig {
    return {
      id: adapter.id,
      name: adapter.name,
      bin: adapter.bin,
      args: adapter.args || [],
      baseLanguage: adapter.baseLanguage,
      description: adapter.description,
      unsupported: adapter.unsupported,
      initializationOptions: adapter.initializationOptions,
    };
  }

  /**
   * Load configuration from JSON file
   */
  private async loadConfigFile(
    filepath: string,
  ): Promise<Partial<ResolvedConfig>> {
    try {
      const content = await readFile(filepath, "utf-8");
      const json = JSON.parse(content);

      return {
        id: json.id,
        name: json.name,
        bin: json.bin,
        args: json.args || [],
        baseLanguage: json.baseLanguage,
        description: json.description,
        unsupported: json.unsupported,
        initializationOptions: json.initializationOptions,
      };
    } catch (error) {
      throw new Error(
        `Failed to load config file ${filepath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Apply CLI overrides to base configuration
   */
  private applyOverrides(
    baseConfig: Partial<ResolvedConfig>,
    overrides: ConfigOverrides,
  ): Partial<ResolvedConfig> {
    const result = { ...baseConfig };

    if (overrides.bin !== undefined) {
      result.bin = overrides.bin;
    }

    if (overrides.args !== undefined) {
      result.args = overrides.args;
    }

    if (overrides.initializationOptions !== undefined) {
      result.initializationOptions = overrides.initializationOptions;
    }

    return result;
  }

  /**
   * Parse bin string into command and args
   * e.g. "npx tsgo --lsp --stdio" -> { bin: "npx", args: ["tsgo", "--lsp", "--stdio"] }
   */
  static parseBinString(binString: string): { bin: string; args: string[] } {
    const parts = binString.trim().split(/\s+/);
    const bin = parts[0];
    const args = parts.slice(1);
    return { bin, args };
  }
}
