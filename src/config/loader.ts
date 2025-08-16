/**
 * Centralized configuration loader for lsmcp
 * Handles loading configuration from multiple sources with proper priority
 */

import { existsSync, readFileSync } from "fs";
import { join, isAbsolute } from "path";
import type { LSMCPConfig, ExtendedLSMCPConfig, Preset } from "./schema.ts";
import { validateConfig } from "./schema.ts";
import { registerBuiltinAdapters } from "./presets.ts";

/**
 * Default base configuration
 */
const DEFAULT_BASE_CONFIG: LSMCPConfig = {
  // No default preset - must be specified explicitly
  files: [], // No default files - must be specified by preset or config
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
  experiments: {
    memory: false,
  },
};

/**
 * Merge configurations with deep merging for nested objects
 */
function mergeConfigs(
  base: Partial<LSMCPConfig>,
  override: Partial<LSMCPConfig>,
): LSMCPConfig {
  const result = { ...base } as LSMCPConfig;

  // Simple fields
  if (override.preset !== undefined) {
    result.preset = override.preset;
  }

  // Handle deprecated memoryAdvanced -> experiments.memory migration
  if (override.memoryAdvanced !== undefined) {
    result.experiments = result.experiments || {};
    result.experiments.memory = override.memoryAdvanced;
  }

  // Deep merge experiments
  if (override.experiments) {
    result.experiments = {
      ...base.experiments,
      ...override.experiments,
    };
  }

  // Deep merge settings
  if (override.settings) {
    result.settings = {
      ...base.settings,
      ...override.settings,
    };
  }

  // Deep merge symbolFilter
  if (override.symbolFilter) {
    result.symbolFilter = {
      ...base.symbolFilter,
      ...override.symbolFilter,
    };
  }

  // Override arrays completely (don't merge)
  if (override.files !== undefined) {
    result.files = override.files;
  }
  if (override.ignorePatterns !== undefined) {
    result.ignorePatterns = override.ignorePatterns;
  }

  return result;
}

/**
 * Configuration sources in priority order
 */
export interface ConfigSources {
  /** Preset name (e.g., "tsgo", "typescript") */
  preset?: string;
  /** Path to config.json file */
  configFile?: string;
  /** Direct configuration object */
  config?: Partial<ExtendedLSMCPConfig>;
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

// Re-export ExtendedLSMCPConfig from schema
export type { ExtendedLSMCPConfig } from "./schema.ts";

/**
 * Result from loading configuration
 */
export interface LoadResult {
  /** The loaded configuration */
  config: ExtendedLSMCPConfig;
  /** Source of the configuration */
  source: "preset" | "file" | "config" | "default";
  /** Any warnings or notes */
  warnings?: string[];
}

/**
 * Registry for preset adapters
 */
export class PresetRegistry {
  private presets = new Map<string, Preset>();

  register(preset: Preset): void {
    this.presets.set(preset.presetId, preset);
  }

  get(id: string): Preset | undefined {
    return this.presets.get(id);
  }

  list(): Preset[] {
    return Array.from(this.presets.values());
  }

  has(id: string): boolean {
    return this.presets.has(id);
  }
}

// Global preset registry
export const globalPresetRegistry = new PresetRegistry();

// Register default presets
registerBuiltinAdapters(globalPresetRegistry);

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
    config: Partial<ExtendedLSMCPConfig>,
    options: LoadOptions,
  ): LoadResult {
    const merged = options.applyDefaults
      ? this.mergeWithDefaults(config)
      : ({ ...DEFAULT_BASE_CONFIG, ...config } as ExtendedLSMCPConfig);

    const validated = options.validate
      ? (validateConfig(merged) as ExtendedLSMCPConfig)
      : merged;

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
    // Check if filePath is already absolute
    const absolutePath = isAbsolute(filePath)
      ? filePath
      : join(this.rootPath, filePath);

    if (!existsSync(absolutePath)) {
      throw new Error(`Configuration file not found: ${absolutePath}`);
    }

    try {
      const content = readFileSync(absolutePath, "utf-8");
      const parsed = JSON.parse(content);

      // Start with parsed config
      let merged: Partial<ExtendedLSMCPConfig> = { ...parsed };

      // If file has a preset field, expand it FIRST
      if (parsed.preset) {
        // Try to get full preset info from registry
        const registeredPreset = globalPresetRegistry.get(parsed.preset);
        if (registeredPreset) {
          // Add full preset properties
          const preset = registeredPreset as Preset;
          const presetConfig: Partial<ExtendedLSMCPConfig> = {
            id: preset.presetId,
            name: preset.name || preset.presetId,
            bin: preset.bin,
            args: preset.args || [],
            binFindStrategy: preset.binFindStrategy,
            baseLanguage: preset.baseLanguage,
            initializationOptions: preset.initializationOptions,
            serverCharacteristics: preset.serverCharacteristics,
            unsupported: preset.unsupported,
            languageFeatures: preset.languageFeatures as
              | Record<string, any>
              | undefined,
            files: preset.files,
          };

          // Merge preset config first, then user config on top
          // Use spread to preserve all extended fields
          merged = { ...presetConfig, ...parsed };

          // If user explicitly set bin in config, remove binFindStrategy from preset
          // This ensures user's bin takes precedence over preset's binFindStrategy
          if (parsed.bin) {
            merged.binFindStrategy = undefined;
          }

          // Special handling for languageFeatures - preserve preset's if not overridden
          if (presetConfig.languageFeatures) {
            if (parsed.languageFeatures) {
              // Deep merge if both exist
              merged.languageFeatures = this.mergeConfigObjects(
                presetConfig.languageFeatures,
                parsed.languageFeatures,
              );
            } else if (!("languageFeatures" in parsed)) {
              // If parsed doesn't have languageFeatures at all, use preset's
              merged.languageFeatures = presetConfig.languageFeatures;
            }
          }
        } else {
          // Fall back to built-in preset file patterns
          const registeredPreset = globalPresetRegistry.get(parsed.preset);
          if (registeredPreset && registeredPreset.files) {
            const presetConfig: Partial<LSMCPConfig> = {
              preset: parsed.preset,
              files: registeredPreset.files,
            };
            merged = { ...presetConfig, ...parsed };
          }
        }
      }

      // Apply defaults AFTER preset expansion
      if (options.applyDefaults) {
        merged = this.mergeWithDefaults(merged);
      } else {
        merged = merged as ExtendedLSMCPConfig;
      }

      // When validating, preserve extended fields
      const finalConfig = options.validate
        ? ({
            ...validateConfig(merged),
            id: merged.id,
            name: merged.name,
            description: merged.description,
            bin: merged.bin,
            args: merged.args,
            binFindStrategy: merged.binFindStrategy,
            baseLanguage: merged.baseLanguage,
            initializationOptions: merged.initializationOptions,
            serverCharacteristics: merged.serverCharacteristics,
            unsupported: merged.unsupported,
            languageFeatures: merged.languageFeatures,
          } as ExtendedLSMCPConfig)
        : (merged as ExtendedLSMCPConfig);

      return {
        config: finalConfig,
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
  public loadFromPreset(presetName: string, options: LoadOptions): LoadResult {
    // First try to get from PresetRegistry
    const registeredPreset = globalPresetRegistry.get(presetName);
    if (registeredPreset) {
      // Convert Preset to ExtendedLSMCPConfig with all preset properties
      const preset = registeredPreset as Preset;
      const config: Partial<ExtendedLSMCPConfig> = {
        preset: presetName,
        files: preset.files,
        // Include all preset properties for runtime use
        id: preset.presetId,
        name: preset.name || preset.presetId,
        bin: preset.bin,
        args: preset.args || [],
        binFindStrategy: preset.binFindStrategy,
        baseLanguage: preset.baseLanguage,
        initializationOptions: preset.initializationOptions,
        serverCharacteristics: preset.serverCharacteristics,
        unsupported: preset.unsupported,
        languageFeatures: preset.languageFeatures as
          | Record<string, any>
          | undefined,
      };
      const merged = options.applyDefaults
        ? this.mergeWithDefaults(config)
        : ({ ...DEFAULT_BASE_CONFIG, ...config } as ExtendedLSMCPConfig);
      // Don't validate preset configs to preserve all fields
      return {
        config: merged,
        source: "preset",
      };
    }

    const available = globalPresetRegistry
      .list()
      .map((p) => p.presetId)
      .join(", ");
    throw new Error(
      `Unknown preset: ${presetName}. Available presets: ${available}`,
    );
  }

  /**
   * Load default configuration
   */
  private loadDefaults(options: LoadOptions): LoadResult {
    const config = options.validate
      ? (validateConfig(DEFAULT_BASE_CONFIG) as ExtendedLSMCPConfig)
      : (DEFAULT_BASE_CONFIG as ExtendedLSMCPConfig);

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
  private mergeWithDefaults(
    config: Partial<ExtendedLSMCPConfig>,
  ): ExtendedLSMCPConfig {
    // Preserve extended fields that are not in DEFAULT_BASE_CONFIG
    const extendedFields: Partial<ExtendedLSMCPConfig> = {};
    const extendedKeys = [
      "id",
      "name",
      "description",
      "bin",
      "args",
      "binFindStrategy",
      "baseLanguage",
      "initializationOptions",
      "serverCharacteristics",
      "unsupported",
      "languageFeatures",
    ] as const;

    for (const key of extendedKeys) {
      if (config[key] !== undefined) {
        (extendedFields as any)[key] = config[key];
      }
    }

    // Merge defaults with config, then add back extended fields
    const merged = mergeConfigs(DEFAULT_BASE_CONFIG, config);
    const result = { ...merged, ...extendedFields } as ExtendedLSMCPConfig;

    return result;
  }

  /**
   * Deep merge two configurations
   */
  private mergeConfigObjects<T extends Record<string, unknown>>(
    base: T,
    override: Partial<T>,
  ): T {
    const result = { ...base } as T;

    for (const key in override) {
      const overrideValue = override[key];
      if (overrideValue === undefined) {
        continue;
      }

      if (overrideValue === null) {
        (result as Record<string, unknown>)[key] = null;
        continue;
      }

      if (typeof overrideValue === "object" && !Array.isArray(overrideValue)) {
        const baseValue = base[key];
        (result as Record<string, unknown>)[key] = this.mergeConfigObjects(
          (baseValue || {}) as Record<string, unknown>,
          overrideValue as Record<string, unknown>,
        );
      } else {
        (result as Record<string, unknown>)[key] = overrideValue;
      }
    }

    return result;
  }

  /**
   * Get the list of available presets
   */
  static getAvailablePresets(): string[] {
    return globalPresetRegistry.list().map((p) => p.presetId);
  }

  /**
   * Get preset configuration
   */
  static getPreset(name: string): Partial<LSMCPConfig> | undefined {
    const preset = globalPresetRegistry.get(name);
    if (preset && preset.files) {
      return {
        preset: name,
        files: preset.files,
      };
    }
    return undefined;
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
