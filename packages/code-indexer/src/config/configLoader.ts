/**
 * Index configuration loader for .lsmcp/config.json
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { IndexConfig } from "./config.ts";
import { errorLog } from "../../../../src/utils/debugLog.ts";

/**
 * Load index configuration from .lsmcp/config.json
 * Returns IndexConfig with defaults merged
 */
export function loadIndexConfig(rootPath: string): IndexConfig {
  const configPath = join(rootPath, ".lsmcp", "config.json");

  // Import default config
  const defaultConfig: IndexConfig = {
    indexFiles: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    settings: {
      indexConcurrency: 5,
      autoIndex: false,
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

  if (!existsSync(configPath)) {
    // Return defaults if no config file
    return defaultConfig;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const userConfig = JSON.parse(content);

    // Merge user config with defaults
    return {
      indexFiles: userConfig.indexFiles ?? defaultConfig.indexFiles,
      settings: {
        ...defaultConfig.settings,
        ...userConfig.settings,
      },
      symbolFilter: {
        ...defaultConfig.symbolFilter,
        ...userConfig.symbolFilter,
      },
      ignorePatterns: userConfig.ignorePatterns ?? defaultConfig.ignorePatterns,
    };
  } catch (error) {
    errorLog(
      `[loadIndexConfig] Failed to load config from ${configPath}:`,
      error,
    );
    // Return defaults on error
    return defaultConfig;
  }
}

/**
 * Get default index pattern from config or fallback
 */
export function getDefaultIndexPattern(rootPath: string): string {
  const config = loadIndexConfig(rootPath);

  if (config?.indexFiles && config.indexFiles.length > 0) {
    // Join multiple patterns with comma (will be handled by glob)
    // Convert array patterns to a single glob pattern
    return config.indexFiles.join(",");
  }

  // Default fallback
  return "**/*.{ts,tsx,js,jsx}";
}

/**
 * Get default concurrency from config or fallback
 */
export function getDefaultConcurrency(rootPath: string): number {
  const config = loadIndexConfig(rootPath);
  return config?.settings?.indexConcurrency ?? 5;
}

/**
 * Get ignored patterns from config
 */
export function getIgnorePatterns(rootPath: string): string[] {
  const config = loadIndexConfig(rootPath);
  // loadIndexConfig always returns a value with defaults
  return (
    config.ignorePatterns ?? ["**/node_modules/**", "**/dist/**", "**/.git/**"]
  );
}
