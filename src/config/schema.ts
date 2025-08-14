/**
 * JSON Schema for .lsmcp/config.json
 */

import { z } from "zod";

// Server characteristics schema
export const serverCharacteristicsSchema = z.object({
  /** Time to wait after opening a document before sending requests (ms) */
  documentOpenDelay: z
    .number()
    .optional()
    .describe(
      "Time to wait after opening a document before sending requests (ms)",
    ),

  /** Time to wait for server readiness check (ms) */
  readinessCheckTimeout: z
    .number()
    .optional()
    .describe("Time to wait for server readiness check (ms)"),

  /** Time to wait for initial diagnostics (ms) */
  initialDiagnosticsTimeout: z
    .number()
    .optional()
    .describe("Time to wait for initial diagnostics (ms)"),

  /** Whether the server requires project-level initialization */
  requiresProjectInit: z
    .boolean()
    .optional()
    .describe("Whether the server requires project-level initialization"),

  /** Whether the server sends diagnostics on document open */
  sendsInitialDiagnostics: z
    .boolean()
    .optional()
    .describe("Whether the server sends diagnostics on document open"),

  /** Maximum timeout for general operations (ms) */
  operationTimeout: z
    .number()
    .optional()
    .describe("Maximum timeout for general operations (ms)"),

  /** Whether the server supports incremental document synchronization */
  supportsIncrementalSync: z
    .boolean()
    .optional()
    .describe(
      "Whether the server supports incremental document synchronization",
    ),

  /** Whether the server supports pull diagnostics */
  supportsPullDiagnostics: z
    .boolean()
    .optional()
    .describe("Whether the server supports pull diagnostics"),
});

export type ServerCharacteristics = z.infer<typeof serverCharacteristicsSchema>;

// Server capabilities schema
export const serverCapabilitiesSchema = z.object({
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
});

export type ServerCapabilities = z.infer<typeof serverCapabilitiesSchema>;

// Individual binary find strategy types
export const binFindStrategyItemSchema = z.discriminatedUnion("type", [
  // Python virtual environment
  z.object({
    type: z.literal("venv"),
    names: z.array(z.string()).describe("Binary names to search in venv/bin"),
    venvDirs: z
      .array(z.string())
      .default([".venv", "venv"])
      .describe("Virtual environment directory names"),
  }),

  // Node modules
  z.object({
    type: z.literal("node_modules"),
    names: z
      .array(z.string())
      .describe("Binary names to search in node_modules/.bin"),
  }),

  // Global installation
  z.object({
    type: z.literal("global"),
    names: z.array(z.string()).describe("Binary names to search globally"),
  }),

  // UV tool run
  z.object({
    type: z.literal("uv"),
    tool: z.string().describe("UV tool name (e.g., 'pyright', 'ruff')"),
    command: z
      .string()
      .optional()
      .describe("Specific command to run from the tool"),
  }),

  // NPX fallback
  z.object({
    type: z.literal("npx"),
    package: z.string().describe("NPX package name"),
  }),

  // Direct path
  z.object({
    type: z.literal("path"),
    path: z.string().describe("Direct path to binary"),
  }),
]);

// Binary find strategy schema
export const binFindStrategySchema = z.object({
  /** Ordered list of strategies to try */
  strategies: z
    .array(binFindStrategyItemSchema)
    .describe("Ordered list of strategies to find the binary"),

  /** Default arguments to pass to the binary */
  defaultArgs: z
    .array(z.string())
    .optional()
    .describe("Default arguments to pass to the LSP server"),
});

export type BinFindStrategy = z.infer<typeof binFindStrategySchema>;

// LSP client config base schema (common fields)
export const lspClientConfigBaseSchema = z.object({
  /** Adapter ID */
  id: z.string().optional().describe("Adapter ID"),

  /** LSP server binary command (optional if binFindStrategy is provided) */
  bin: z.string().optional().describe("LSP server binary command"),

  /** Command line arguments for the LSP server */
  args: z
    .array(z.string())
    .optional()
    .describe("Command line arguments for the LSP server"),

  /** Binary find strategy (ignored when bin/args are explicitly set) */
  binFindStrategy: binFindStrategySchema
    .optional()
    .describe("Strategy for finding the LSP server binary"),

  /** LSP initialization options */
  initializationOptions: z
    .unknown()
    .optional()
    .describe("LSP initialization options"),

  /** Analyze targets */
  files: z.array(z.string()).describe("Glob patterns for files to analyze"),

  /** List of unsupported LSP features */
  disable: z
    .array(z.string())
    .optional()
    .describe("List of unsupported LSP features"),

  /** Whether diagnostics need deduplication */
  needsDiagnosticDeduplication: z
    .boolean()
    .optional()
    .describe("Whether diagnostics need deduplication"),

  /** Server-specific behavior characteristics */
  serverCharacteristics: serverCharacteristicsSchema.optional(),

  /** Server capabilities */
  serverCapabilities: serverCapabilitiesSchema.optional(),

  /** Base language for this adapter */
  baseLanguage: z
    .string()
    .optional()
    .describe("Base language for this adapter"),
});

// LSP client config type (no runtime-only fields anymore)
export const lspClientConfigSchema = lspClientConfigBaseSchema;

export type LspClientConfig = z.infer<typeof lspClientConfigBaseSchema>;

// Preset schema
export const presetSchema = lspClientConfigSchema.extend({
  /** Unique identifier */
  presetId: z.string().describe("Unique preset identifier"),

  /** Display name */
  name: z.string().optional().describe("Display name"),

  /** Description of this preset */
  description: z.string().optional().describe("Description"),

  /** Language-specific features configuration */
  languageFeatures: z
    .unknown()
    .optional()
    .describe("Language-specific features"),

  /** Unsupported features */
  unsupported: z.array(z.string()).optional().describe("Unsupported features"),
});

export type Preset = z.infer<typeof presetSchema>;

// Main config schema
export const configSchema = z
  .object({
    /** JSON Schema reference */
    $schema: z.string().optional().describe("JSON Schema reference"),

    /** Preset adapter name (e.g., "tsgo", "typescript", "rust-analyzer") */
    preset: z.string().optional().describe("Preset adapter to use"),

    /** Glob patterns for files to index (required when no preset) */
    files: z
      .array(z.string())
      .optional()
      .describe("Glob patterns for files to index"),

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

    /** Experimental features configuration */
    experiments: z
      .object({
        /** Enable advanced memory features with database storage */
        memory: z
          .boolean()
          .default(false)
          .describe("Enable advanced memory features with database storage"),
      })
      .default({})
      .describe("Experimental features configuration"),

    /** @deprecated Use experiments.memory instead */
    memoryAdvanced: z
      .boolean()
      .optional()
      .describe("[Deprecated] Use experiments.memory instead"),

    // LSP adapter fields (when using custom config instead of preset)
    /** LSP server binary command */
    bin: z.string().optional().describe("LSP server binary command"),

    /** Command line arguments for the LSP server */
    args: z.array(z.string()).optional().describe("Command line arguments"),

    /** LSP initialization options */
    initializationOptions: z
      .unknown()
      .optional()
      .describe("LSP initialization options"),

    /** List of unsupported LSP features */
    unsupported: z
      .array(z.string())
      .optional()
      .describe("Unsupported LSP features"),

    /** Server characteristics */
    serverCharacteristics: serverCharacteristicsSchema.optional(),
  })
  .refine(
    (data) => {
      // If no preset is specified, files must be provided
      if (!data.preset && !data.files) {
        return false;
      }
      return true;
    },
    {
      message: "'files' is required when no preset is specified",
      path: ["files"],
    },
  );

// Type exports
export type LSMCPConfig = z.infer<typeof configSchema>;

// Extended config type for runtime (includes preset fields)
export interface ExtendedLSMCPConfig extends LSMCPConfig {
  // Runtime properties from preset
  id?: string;
  name?: string;
  description?: string;
  baseLanguage?: string;
  serverCapabilities?: ServerCapabilities;
  languageFeatures?: Record<string, any>;
  needsDiagnosticDeduplication?: boolean;
  binFindStrategy?: BinFindStrategy;
}

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
  files: [], // No default files - must be specified by preset or config
  settings: {
    autoIndex: false,
    indexConcurrency: 5,
    autoIndexDelay: 500,
    enableWatchers: true,
    memoryLimit: 1024,
  },
  symbolFilter: DEFAULT_SYMBOL_FILTER,
  ignorePatterns: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
  experiments: {
    memory: false, // Default to disabled
  },
};

/**
 * Validate config against schema
 */
export function validateConfig(config: unknown): LSMCPConfig {
  return configSchema.parse(config);
}

/**
 * Create config from preset
 */
export function createConfigFromPreset(
  preset: string,
  indexPatterns?: string[],
): LSMCPConfig {
  return {
    ...DEFAULT_CONFIG,
    preset,
    files: indexPatterns || [], // No default files - must be specified
    symbolFilter: DEFAULT_SYMBOL_FILTER,
  };
}
