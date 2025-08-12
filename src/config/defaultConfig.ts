/**
 * Default configuration values for lsmcp
 * These values are used when no configuration is provided
 */

import type { LSMCPConfig } from "./configSchema.ts";

/**
 * Default base configuration
 */
export const DEFAULT_BASE_CONFIG: LSMCPConfig = {
  preset: "tsgo",
  files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
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
  memoryAdvanced: false,
};

/**
 * Preset-specific file patterns (from src/adapters/)
 */
export const PRESET_FILE_PATTERNS: Record<string, string[]> = {
  tsgo: ["**/*.ts", "**/*.tsx"],
  typescript: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  deno: ["**/*.ts", "**/*.tsx"],
  "rust-analyzer": ["**/*.rs"],
  pyright: ["**/*.py", "**/*.pyi"],
  gopls: ["**/*.go"],
  fsharp: ["**/*.fs", "**/*.fsi", "**/*.fsx"],
  moonbit: ["**/*.mbt", "**/*.mbti"],
};

/**
 * Merge configurations with deep merging for nested objects
 */
export function mergeConfigs(
  base: Partial<LSMCPConfig>,
  override: Partial<LSMCPConfig>,
): LSMCPConfig {
  const result = { ...base } as LSMCPConfig;

  // Simple fields
  if (override.preset !== undefined) {
    result.preset = override.preset;
  }
  if (override.memoryAdvanced !== undefined) {
    result.memoryAdvanced = override.memoryAdvanced;
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
 * Create a complete configuration from partial user config
 */
export function createCompleteConfig(
  userConfig?: Partial<LSMCPConfig>,
): LSMCPConfig {
  if (!userConfig) {
    // Return default configuration
    return DEFAULT_BASE_CONFIG;
  }

  // Start with default base config
  let finalConfig = { ...DEFAULT_BASE_CONFIG };

  // If preset is specified, use preset-specific file patterns
  if (userConfig.preset && PRESET_FILE_PATTERNS[userConfig.preset]) {
    finalConfig.files = PRESET_FILE_PATTERNS[userConfig.preset];
  }

  // Merge user config with defaults
  return mergeConfigs(finalConfig, userConfig);
}
