/**
 * Centralized configuration loader for lsmcp
 * Handles loading configuration from multiple sources with proper priority
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { LSMCPConfig } from "./configSchema.ts";
import { validateConfig } from "./configSchema.ts";
import type { Preset } from "../types/lsp.ts";
import { DEFAULT_BASE_CONFIG, PRESET_FILE_PATTERNS } from "./defaultConfig.ts";

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

/**
 * Extended configuration that includes preset runtime properties
 */
export interface ExtendedLSMCPConfig extends LSMCPConfig {
  // Runtime properties from preset
  id?: string;
  name?: string;
  description?: string;
  bin?: string;
  args?: string[];
  baseLanguage?: string;
  initializationOptions?: unknown;
  serverCharacteristics?: unknown;
  unsupported?: string[];
  languageFeatures?: Record<string, any>;
}

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
        : { ...parsed }; // Always ensure version field

      // If file has a preset field, expand it
      if (parsed.preset) {
        // Try to get full preset info from registry
        const registeredPreset = globalPresetRegistry.get(parsed.preset);
        if (registeredPreset) {
          // Add full preset properties
          const presetConfig: Partial<ExtendedLSMCPConfig> = {
            id: registeredPreset.presetId,
            name: registeredPreset.name || registeredPreset.presetId,
            bin: registeredPreset.bin,
            args: registeredPreset.args || [],
            baseLanguage: registeredPreset.baseLanguage,
            initializationOptions: registeredPreset.initializationOptions,
            serverCharacteristics: registeredPreset.serverCharacteristics,
            unsupported: registeredPreset.unsupported,
            languageFeatures: registeredPreset.languageFeatures as
              | Record<string, any>
              | undefined,
            files: registeredPreset.files,
          };
          merged = this.mergeConfigs(presetConfig, merged);
        } else {
          // Fall back to built-in preset file patterns
          if (PRESET_FILE_PATTERNS[parsed.preset]) {
            const presetConfig: Partial<LSMCPConfig> = {
              preset: parsed.preset,
              files: PRESET_FILE_PATTERNS[parsed.preset],
            };
            merged = this.mergeConfigs(presetConfig, merged);
          }
        }
      }

      return {
        config: options.validate
          ? (validateConfig(merged) as ExtendedLSMCPConfig)
          : merged,
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
  loadFromPreset(presetName: string, options: LoadOptions): LoadResult {
    // First try to get from PresetRegistry
    const registeredPreset = globalPresetRegistry.get(presetName);
    if (registeredPreset) {
      // Convert Preset to ExtendedLSMCPConfig with all preset properties
      const config: Partial<ExtendedLSMCPConfig> = {
        preset: presetName,
        files: registeredPreset.files,
        // Include all preset properties for runtime use
        id: registeredPreset.presetId,
        name: registeredPreset.name || registeredPreset.presetId,
        bin: registeredPreset.bin,
        args: registeredPreset.args || [],
        baseLanguage: registeredPreset.baseLanguage,
        initializationOptions: registeredPreset.initializationOptions,
        serverCharacteristics: registeredPreset.serverCharacteristics,
        unsupported: registeredPreset.unsupported,
        languageFeatures: registeredPreset.languageFeatures as
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

    // Fall back to built-in preset file patterns
    if (PRESET_FILE_PATTERNS[presetName]) {
      const config: Partial<ExtendedLSMCPConfig> = {
        preset: presetName,
        files: PRESET_FILE_PATTERNS[presetName],
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

    const available = [
      ...globalPresetRegistry.list().map((p) => p.presetId),
      ...Object.keys(PRESET_FILE_PATTERNS),
    ].join(", ");
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
    return this.mergeConfigs(DEFAULT_BASE_CONFIG, config);
  }

  /**
   * Deep merge two configurations
   */
  private mergeConfigs<T extends Record<string, unknown>>(
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
        (result as Record<string, unknown>)[key] = this.mergeConfigs(
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
    return Object.keys(PRESET_FILE_PATTERNS);
  }

  /**
   * Get preset configuration
   */
  static getPreset(name: string): Partial<LSMCPConfig> | undefined {
    if (PRESET_FILE_PATTERNS[name]) {
      return {
        preset: name,
        files: PRESET_FILE_PATTERNS[name],
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
