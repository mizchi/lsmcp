/**
 * JSON Schema for .lsmcp/config.json
 */

import { z } from "zod";

// Server characteristics schema
const serverCharacteristicsSchema = z
  .object({
    supportsRename: z.boolean().optional(),
    supportsReferences: z.boolean().optional(),
    supportsDefinition: z.boolean().optional(),
    supportsHover: z.boolean().optional(),
    supportsDocumentSymbol: z.boolean().optional(),
    supportsWorkspaceSymbol: z.boolean().optional(),
    supportsCompletion: z.boolean().optional(),
    supportsSignatureHelp: z.boolean().optional(),
    supportsDocumentFormatting: z.boolean().optional(),
    supportsRangeFormatting: z.boolean().optional(),
    supportsCodeAction: z.boolean().optional(),
    supportsDiagnostics: z.boolean().optional(),
    supportsInlayHint: z.boolean().optional(),
    supportsSemanticTokens: z.boolean().optional(),
  })
  .optional();

// LSP adapter configuration schema
const lspAdapterSchema = z.object({
  /** Unique identifier for the adapter */
  id: z.string().describe("Unique identifier for the adapter"),

  /** Display name */
  name: z.string().describe("Display name for the adapter"),

  /** LSP server binary/command */
  bin: z.string().describe("LSP server binary path or command"),

  /** Arguments to pass to the LSP server */
  args: z
    .array(z.string())
    .default([])
    .describe("Arguments for the LSP server")
    .optional(),

  /** Base language ID */
  baseLanguage: z
    .string()
    .optional()
    .describe("Base language ID (e.g., 'typescript')"),

  /** Description */
  description: z.string().optional().describe("Description of the adapter"),

  /** Unsupported features */
  unsupported: z
    .array(z.string())
    .optional()
    .describe("List of unsupported MCP tools"),

  /** Language-specific initialization options */
  initializationOptions: z
    .any()
    .optional()
    .describe("LSP initialization options"),

  /** Server characteristics */
  serverCharacteristics: serverCharacteristicsSchema,
});

// Main config schema
export const configSchema = z.object({
  /** Version of the config file format */
  version: z.literal("1.0").describe("Config file format version"),

  /** Glob patterns for files to index */
  indexFiles: z
    .array(z.string())
    .default(["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"])
    .describe("Glob patterns for files to index"),

  /** Language adapter configuration */
  adapter: lspAdapterSchema
    .optional()
    .describe("LSP adapter configuration (expanded from preset)"),

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
});

// Type exports
export type LSMCPConfig = z.infer<typeof configSchema>;
export type LspAdapter = z.infer<typeof lspAdapterSchema>;
export type ServerCharacteristics = z.infer<typeof serverCharacteristicsSchema>;

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
  ignorePatterns: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
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
  };
}
