/**
 * Centralized configuration loader for lsmcp
 * Handles loading configuration from multiple sources with proper priority
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { LSMCPConfig } from "./configSchema.ts";
import { validateConfig } from "./configSchema.ts";

/**
 * Configuration sources in priority order
 */
export interface ConfigSources {
  /** Preset name (e.g., "tsgo", "typescript") */
  preset?: string;
  /** Path to config.json file */
  configFile?: string;
  /** Direct configuration object */
  config?: Partial<LSMCPConfig>;
}

/**
 * Load options for the configuration loader
 */
export interface LoadOptions {
  /** Root directory for resolving relative paths */
  rootPath?: string;
  /** Whether to validate the configuration */
  validate?: boolean;
  /** Whether to apply defaults */
  applyDefaults?: boolean;
}

/**
 * Result from loading configuration
 */
export interface LoadResult {
  /** The loaded configuration */
  config: LSMCPConfig;
  /** Source of the configuration */
  source: "preset" | "file" | "config" | "default";
  /** Any warnings or notes */
  warnings?: string[];
}

/**
 * Built-in presets
 */
const PRESETS: Record<string, Partial<LSMCPConfig>> = {
  tsgo: {
    preset: "tsgo",
    lsp: {
      bin: "npx",
      args: ["-y", "tsgo", "--lsp", "--stdio"],
      initializationOptions: {
        preferences: {
          includeInlayParameterNameHints: "none",
          includeInlayParameterNameHintsWhenArgumentMatchesName: false,
          includeInlayFunctionParameterTypeHints: false,
          includeInlayVariableTypeHints: false,
          includeInlayPropertyDeclarationTypeHints: false,
          includeInlayFunctionLikeReturnTypeHints: false,
          includeInlayEnumMemberValueHints: false,
        },
        maxTsServerMemory: 4096,
      },
    },
  },
  typescript: {
    preset: "typescript",
    lsp: {
      bin: "typescript-language-server",
      args: ["--stdio"],
    },
  },
  "rust-analyzer": {
    preset: "rust-analyzer",
    lsp: {
      bin: "rust-analyzer",
      args: [],
    },
  },
  pyright: {
    preset: "pyright",
    lsp: {
      bin: "pyright-langserver",
      args: ["--stdio"],
    },
    indexFiles: ["**/*.py", "**/*.pyi"],
  },
  gopls: {
    preset: "gopls",
    lsp: {
      bin: "gopls",
      args: ["serve"],
    },
    indexFiles: ["**/*.go"],
  },
};

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: any = {
  version: "1.0",
  preset: "tsgo",
  indexFiles: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  settings: {
    autoIndex: false,
    indexConcurrency: 5,
    autoIndexDelay: 500,
    enableWatchers: true,
    memoryLimit: 1024,
  },
  symbolFilter: {
    excludeKinds: [
      "Variable",
      "Constant",
      "String",
      "Number",
      "Boolean",
      "Array",
      "Object",
      "Key",
      "Null",
    ],
    excludePatterns: ["callback", "temp", "tmp", "_", "^[a-z]$"],
    includeOnlyTopLevel: false,
  },
  ignorePatterns: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
};

/**
 * Configuration loader class
 */
export class ConfigLoader {
  private rootPath: string;
  private cache?: LoadResult;

  constructor(rootPath: string = process.cwd()) {
    this.rootPath = rootPath;
  }

  /**
   * Load configuration from sources
   */
  async load(
    sources: ConfigSources = {},
    options: LoadOptions = {},
  ): Promise<LoadResult> {
    const opts = {
      validate: true,
      applyDefaults: true,
      ...options,
    };

    // Check cache
    if (
      this.cache &&
      !sources.config &&
      !sources.configFile &&
      !sources.preset
    ) {
      return this.cache;
    }

    let result: LoadResult;

    // Priority 1: Direct config object
    if (sources.config) {
      result = this.loadFromConfig(sources.config, opts);
    }
    // Priority 2: Config file
    else if (sources.configFile) {
      result = await this.loadFromFile(sources.configFile, opts);
    }
    // Priority 3: Preset
    else if (sources.preset) {
      result = this.loadFromPreset(sources.preset, opts);
    }
    // Priority 4: Auto-detect config file
    else {
      const configPath = this.findConfigFile();
      if (configPath) {
        result = await this.loadFromFile(configPath, opts);
      } else {
        result = this.loadDefaults(opts);
      }
    }

    // Cache the result
    this.cache = result;
    return result;
  }

  /**
   * Load configuration from a direct config object
   */
  private loadFromConfig(
    config: Partial<LSMCPConfig>,
    options: LoadOptions,
  ): LoadResult {
    const merged = options.applyDefaults
      ? this.mergeWithDefaults(config)
      : ({ version: "1.0", ...config } as LSMCPConfig); // Always ensure version field

    const validated = options.validate ? validateConfig(merged) : merged;

    return {
      config: validated,
      source: "config",
    };
  }

  /**
   * Load configuration from a file
   */
  private async loadFromFile(
    filePath: string,
    options: LoadOptions,
  ): Promise<LoadResult> {
    const absolutePath = join(this.rootPath, filePath);

    if (!existsSync(absolutePath)) {
      throw new Error(`Configuration file not found: ${absolutePath}`);
    }

    try {
      const content = readFileSync(absolutePath, "utf-8");
      const parsed = JSON.parse(content);

      // Merge with defaults if requested
      let merged = options.applyDefaults
        ? this.mergeWithDefaults(parsed)
        : { version: "1.0", ...parsed }; // Always ensure version field

      // If file has a preset field, expand it
      if (parsed.preset && !parsed.lsp && !parsed.adapter) {
        const preset = PRESETS[parsed.preset];
        if (preset) {
          Object.assign(merged, this.mergeConfigs(merged, preset));
        }
      }

      return {
        config: options.validate ? validateConfig(merged) : merged,
        source: "file",
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          `Invalid JSON in config file ${absolutePath}: ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Load configuration from a preset
   */
  private loadFromPreset(presetName: string, options: LoadOptions): LoadResult {
    const preset = PRESETS[presetName];

    if (!preset) {
      const available = Object.keys(PRESETS).join(", ");
      throw new Error(
        `Unknown preset: ${presetName}. Available presets: ${available}`,
      );
    }

    const merged = options.applyDefaults
      ? this.mergeWithDefaults(preset)
      : (preset as LSMCPConfig);

    return {
      config: options.validate ? validateConfig(merged) : merged,
      source: "preset",
    };
  }

  /**
   * Load default configuration
   */
  private loadDefaults(options: LoadOptions): LoadResult {
    const config = options.validate
      ? validateConfig(DEFAULT_CONFIG)
      : DEFAULT_CONFIG;

    return {
      config,
      source: "default",
      warnings: ["No configuration found, using defaults"],
    };
  }

  /**
   * Find configuration file in standard locations
   */
  private findConfigFile(): string | null {
    const locations = [
      ".lsmcp/config.json",
      "lsmcp.config.json",
      ".lsmcprc.json",
      ".lsmcprc",
    ];

    for (const location of locations) {
      const path = join(this.rootPath, location);
      if (existsSync(path)) {
        return location;
      }
    }

    return null;
  }

  /**
   * Merge configuration with defaults
   */
  private mergeWithDefaults(config: Partial<LSMCPConfig>): LSMCPConfig {
    return this.mergeConfigs(DEFAULT_CONFIG, config);
  }

  /**
   * Deep merge two configurations
   */
  private mergeConfigs(base: any, override: any): any {
    const result = { ...base };

    for (const key in override) {
      if (override[key] === undefined) {
        continue;
      }

      if (override[key] === null) {
        result[key] = null;
        continue;
      }

      if (typeof override[key] === "object" && !Array.isArray(override[key])) {
        result[key] = this.mergeConfigs(base[key] || {}, override[key]);
      } else {
        result[key] = override[key];
      }
    }

    return result;
  }

  /**
   * Get the list of available presets
   */
  static getAvailablePresets(): string[] {
    return Object.keys(PRESETS);
  }

  /**
   * Get preset configuration
   */
  static getPreset(name: string): Partial<LSMCPConfig> | undefined {
    return PRESETS[name];
  }

  /**
   * Validate a configuration object
   */
  static validate(config: unknown): LSMCPConfig {
    return validateConfig(config);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache = undefined;
  }
}
