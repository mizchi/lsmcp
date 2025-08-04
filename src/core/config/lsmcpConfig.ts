/**
 * Configuration for lsmcp project
 */

import type { AdapterConfig } from "./configLoader.ts";

export interface LSMCPConfig {
  /** Version of the config file format */
  version: "1.0";

  /** Glob patterns for files to index */
  indexFiles?: string[];

  /** Language adapter configuration (expanded from preset) */
  adapter?: AdapterConfig;

  /** Additional settings */
  settings?: {
    /** Auto-index on startup */
    autoIndex?: boolean;
    /** Index concurrency */
    indexConcurrency?: number;
  };
}

export const DEFAULT_CONFIG: LSMCPConfig = {
  version: "1.0",
  indexFiles: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  settings: {
    autoIndex: false,
    indexConcurrency: 5,
  },
};
