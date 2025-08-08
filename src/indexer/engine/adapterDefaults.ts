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
    patterns: [
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx",
      "**/*.mjs",
      "**/*.mts",
    ],
    concurrency: 5,
  },
  "typescript-language-server": {
    patterns: [
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx",
      "**/*.mjs",
      "**/*.mts",
    ],
    concurrency: 5,
  },
  tsgo: {
    patterns: [
      "**/*.ts",
      "**/*.tsx",
      "**/*.js",
      "**/*.jsx",
      "**/*.mjs",
      "**/*.mts",
    ],
    concurrency: 5,
  },
  deno: {
    patterns: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    concurrency: 5,
  },

  // Python adapters
  pyright: {
    patterns: ["**/*.py", "**/*.pyi"],
    concurrency: 5,
  },
  ruff: {
    patterns: ["**/*.py", "**/*.pyi"],
    concurrency: 5,
  },

  // Rust
  "rust-analyzer": {
    patterns: ["**/*.rs"],
    concurrency: 3, // Rust analyzer can be memory intensive
  },

  // Go
  gopls: {
    patterns: ["**/*.go"],
    concurrency: 5,
  },

  // F#
  fsharp: {
    patterns: ["**/*.fs", "**/*.fsx", "**/*.fsi"],
    concurrency: 3,
  },

  // Moonbit
  moonbit: {
    patterns: ["**/*.mbt"],
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
