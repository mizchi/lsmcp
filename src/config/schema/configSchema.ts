/**
 * JSON Schema for .lsmcp/config.json
 */

import { z } from "zod";
import {
  serverCapabilitiesSchema,
  lspConfigSchema,
  lspAdapterConfigSchema,
} from "../../types/config.ts";

// For backward compatibility, export the schema as lspAdapterSchema
const lspAdapterSchema = lspAdapterConfigSchema;

// Main config schema
export const configSchema = z.object({
  /** JSON Schema reference */
  $schema: z.string().optional().describe("JSON Schema reference"),

  /** Version of the config file format */
  version: z.literal("1.0").optional().describe("Config file format version"),

  /** Preset adapter name (e.g., "tsgo", "typescript", "rust-analyzer") */
  preset: z.string().optional().describe("Preset adapter to use"),

  /** Glob patterns for files to index */
  indexFiles: z
    .array(z.string())
    .default(["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"])
    .describe("Glob patterns for files to index"),

  /** LSP server configuration (advanced - overrides preset) */
  lsp: lspConfigSchema.optional().describe("LSP server configuration"),

  /** Legacy: Language adapter configuration (deprecated - use 'lsp' instead) */
  adapter: lspAdapterSchema
    .optional()
    .describe("Deprecated: Use 'lsp' field instead"),

  /** Additional settings */
  settings: z
    .object({
      /** Auto-index on startup */
      autoIndex: z
        .boolean()
        .default(false)
        .describe("Automatically index files on startup"),

      /** Index concurrency */
      indexConcurrency: z
        .number()
        .min(1)
        .max(20)
        .default(5)
        .describe("Number of files to index in parallel"),

      /** Auto-index delay in milliseconds */
      autoIndexDelay: z
        .number()
        .min(100)
        .max(5000)
        .default(500)
        .describe("Delay before auto-indexing after file changes (ms)"),

      /** Enable file watchers */
      enableWatchers: z
        .boolean()
        .default(true)
        .describe("Enable file watchers for auto-indexing"),

      /** Memory limit for indexing (MB) */
      memoryLimit: z
        .number()
        .min(100)
        .max(4096)
        .default(1024)
        .describe("Memory limit for indexing operations (MB)"),
    })
    .default({})
    .describe("Additional settings"),

  /** Ignore patterns (in addition to .gitignore) */
  ignorePatterns: z
    .array(z.string())
    .default(["**/node_modules/**", "**/dist/**", "**/.git/**"])
    .describe("Additional ignore patterns for indexing"),

  /** Symbol filter configuration */
  symbolFilter: z
    .object({
      /** Exclude specific symbol kinds */
      excludeKinds: z
        .array(z.string())
        .optional()
        .describe("Symbol kinds to exclude from indexing"),

      /** Exclude symbols matching these patterns */
      excludePatterns: z
        .array(z.string())
        .optional()
        .describe("Regex patterns for symbols to exclude"),

      /** Only include top-level symbols */
      includeOnlyTopLevel: z
        .boolean()
        .optional()
        .describe("Whether to include only top-level symbols"),
    })
    .optional()
    .describe("Symbol filtering configuration"),

  /** Advanced memory features configuration */
  memoryAdvanced: z
    .boolean()
    .default(false)
    .describe("Enable advanced memory features with database storage"),

  /** Language-specific features configuration */
  languageFeatures: z
    .object({
      /** Enable external library indexing for TypeScript/JavaScript */
      typescript: z
        .object({
          enabled: z
            .boolean()
            .default(false)
            .describe("Enable TypeScript external library indexing"),
          indexNodeModules: z
            .boolean()
            .default(true)
            .describe("Index node_modules dependencies"),
          maxFiles: z
            .number()
            .min(100)
            .max(10000)
            .default(5000)
            .describe("Maximum number of files to index from node_modules"),
        })
        .optional()
        .describe("TypeScript-specific features"),

      /** Enable external library indexing for Rust */
      rust: z
        .object({
          enabled: z
            .boolean()
            .default(false)
            .describe("Enable Rust crate indexing"),
          indexCargo: z
            .boolean()
            .default(true)
            .describe("Index Cargo dependencies"),
        })
        .optional()
        .describe("Rust-specific features"),

      /** Enable external library indexing for Go */
      go: z
        .object({
          enabled: z
            .boolean()
            .default(false)
            .describe("Enable Go module indexing"),
          indexGoModules: z
            .boolean()
            .default(true)
            .describe("Index Go module dependencies"),
        })
        .optional()
        .describe("Go-specific features"),

      /** Enable external library indexing for Python */
      python: z
        .object({
          enabled: z
            .boolean()
            .default(false)
            .describe("Enable Python package indexing"),
          indexSitePackages: z
            .boolean()
            .default(true)
            .describe("Index site-packages dependencies"),
        })
        .optional()
        .describe("Python-specific features"),
    })
    .default({})
    .describe("Language-specific features configuration"),
});

// Type exports
export type LSMCPConfig = z.infer<typeof configSchema>;
export type LspAdapter = z.infer<typeof lspAdapterSchema>;
export type ServerCharacteristics = z.infer<typeof serverCapabilitiesSchema>;

// Default symbol filter configuration
export const DEFAULT_SYMBOL_FILTER = {
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
};

// Default configuration
export const DEFAULT_CONFIG: LSMCPConfig = {
  version: "1.0",
  indexFiles: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  settings: {
    autoIndex: false,
    indexConcurrency: 5,
    autoIndexDelay: 500,
    enableWatchers: true,
    memoryLimit: 1024,
  },
  symbolFilter: DEFAULT_SYMBOL_FILTER,
  ignorePatterns: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
  memoryAdvanced: false, // Default to disabled
  languageFeatures: {}, // Default to no language features enabled
};

/**
 * Validate config against schema
 */
export function validateConfig(config: unknown): LSMCPConfig {
  return configSchema.parse(config);
}

/**
 * Create config from preset adapter
 */
export function createConfigFromAdapter(
  adapter: LspAdapter,
  indexPatterns?: string[],
): LSMCPConfig {
  return {
    ...DEFAULT_CONFIG,
    adapter,
    indexFiles: indexPatterns || DEFAULT_CONFIG.indexFiles,
    symbolFilter: DEFAULT_SYMBOL_FILTER,
  };
}
