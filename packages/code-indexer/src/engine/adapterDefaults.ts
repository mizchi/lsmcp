import {
  LANGUAGE_PATTERNS,
  getTsJsPatterns,
} from "../../../../src/config/languagePatterns.ts";

/**
 * Default index patterns for different language adapters
 */

export interface AdapterIndexDefaults {
  patterns: string[];
  concurrency?: number;
}

// Default patterns for each language adapter
export const adapterDefaults: Record<string, AdapterIndexDefaults> = {
  // TypeScript/JavaScript adapters
  typescript: {
    patterns: getTsJsPatterns(),
    concurrency: 5,
  },
  "typescript-language-server": {
    patterns: getTsJsPatterns(),
    concurrency: 5,
  },
  tsgo: {
    patterns: getTsJsPatterns(),
    concurrency: 5,
  },
  deno: {
    patterns: [...LANGUAGE_PATTERNS.typescript, "**/*.js", "**/*.jsx"],
    concurrency: 5,
  },

  // Python adapters
  pyright: {
    patterns: LANGUAGE_PATTERNS.python,
    concurrency: 5,
  },
  ruff: {
    patterns: LANGUAGE_PATTERNS.python,
    concurrency: 5,
  },

  // Rust
  "rust-analyzer": {
    patterns: LANGUAGE_PATTERNS.rust,
    concurrency: 3, // Rust analyzer can be memory intensive
  },

  // Go
  gopls: {
    patterns: LANGUAGE_PATTERNS.go,
    concurrency: 5,
  },

  // F#
  fsharp: {
    patterns: LANGUAGE_PATTERNS.fsharp,
    concurrency: 3,
  },

  // Moonbit
  moonbit: {
    patterns: LANGUAGE_PATTERNS.moonbit,
    concurrency: 5,
  },

  // Default fallback
  default: {
    patterns: ["**/*"],
    concurrency: 5,
  },
};

/**
 * Get default patterns for an adapter
 */
export function getAdapterDefaultPattern(adapterId: string): string {
  const defaults = adapterDefaults[adapterId] || adapterDefaults.default;
  return defaults.patterns.join(",");
}

/**
 * Get default concurrency for an adapter
 */
export function getAdapterDefaultConcurrency(adapterId: string): number {
  const defaults = adapterDefaults[adapterId] || adapterDefaults.default;
  return defaults.concurrency || 5;
}
