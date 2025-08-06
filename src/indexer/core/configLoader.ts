/**
 * Index configuration loader for .lsmcp/config.json
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

export interface IndexConfig {
  indexFiles?: string[];
  settings?: {
    indexConcurrency?: number;
    autoIndex?: boolean;
    autoIndexDelay?: number;
    enableWatchers?: boolean;
    memoryLimit?: number;
  };
  symbolFilter?: {
    excludeKinds?: string[];
    excludePatterns?: string[];
    includeOnlyTopLevel?: boolean;
  };
  ignorePatterns?: string[];
}

/**
 * Load index configuration from .lsmcp/config.json
 */
export function loadIndexConfig(rootPath: string): IndexConfig | null {
  const configPath = join(rootPath, ".lsmcp", "config.json");

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content);

    // Extract relevant indexing configuration
    return {
      indexFiles: config.indexFiles,
      settings: config.settings,
      symbolFilter: config.symbolFilter,
      ignorePatterns: config.ignorePatterns,
    };
  } catch (error) {
    console.error(
      `[loadIndexConfig] Failed to load config from ${configPath}:`,
      error,
    );
    return null;
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
  return (
    config?.ignorePatterns ?? ["**/node_modules/**", "**/dist/**", "**/.git/**"]
  );
}
