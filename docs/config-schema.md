# LSMCP Configuration Schema

The `.lsmcp/config.json` file configures both the LSMCP language server adapter (via preset/bin/args) and the symbol indexing behavior for your project.

Notes

- The indexer reads `.lsmcp/config.json` to get index patterns, settings, and symbol filtering (see symbolFilter below).
- Unknown fields are ignored by the indexer loader and won’t break it.
- Some runtime options for the MCP server (e.g., enabling TypeScript-specific tools) are resolved by the main runtime config loader and may not be picked up by the indexer. See README for adapter presets and runtime configuration.

Schema Version
Current version: 1.0 (descriptive, not strictly validated at runtime)

Complete Schema

```typescript
interface LSMCPConfig {
  // Optional: Config file format version (informational)
  version?: "1.0";

  // Glob patterns for files to index
  // - The indexer will join an array into a comma-separated pattern internally
  indexFiles?: string[];

  // Language adapter configuration (expanded from preset)
  // - Used by the MCP runtime loader when a full adapter config is embedded here
  adapter?: {
    // Unique identifier for the adapter (e.g. "typescript", "tsgo", "gopls")
    id: string;

    // Display name
    name: string;

    // LSP server binary path or command
    bin: string;

    // Arguments for the LSP server
    args?: string[];

    // Base language ID (e.g., "typescript")
    baseLanguage?: string;

    // Description of the adapter
    description?: string;

    // List of unsupported MCP tools
    unsupported?: string[];

    // Language-specific initialization options
    initializationOptions?: any;

    // Server characteristics/capabilities (hints)
    serverCharacteristics?: {
      supportsRename?: boolean;
      supportsReferences?: boolean;
      supportsDefinition?: boolean;
      supportsHover?: boolean;
      supportsDocumentSymbol?: boolean;
      supportsWorkspaceSymbol?: boolean;
      supportsCompletion?: boolean;
      supportsSignatureHelp?: boolean;
      supportsDocumentFormatting?: boolean;
      supportsRangeFormatting?: boolean;
      supportsCodeAction?: boolean;
      supportsDiagnostics?: boolean;
      supportsInlayHint?: boolean;
      supportsSemanticTokens?: boolean;
    };
  };

  // Indexer settings
  settings?: {
    // Automatically index files on startup
    autoIndex?: boolean; // default: false

    // Number of files to index in parallel
    indexConcurrency?: number; // default: 5, min: 1, max: 20

    // Delay before auto-indexing after file changes (ms)
    autoIndexDelay?: number; // default: 500, min: 100, max: 5000

    // Enable file watchers for auto-indexing
    enableWatchers?: boolean; // default: true

    // Memory limit for indexing operations (MB)
    memoryLimit?: number; // default: 1024, min: 100, max: 4096
  };

  // Symbol filtering configuration for the indexer
  // - Controls which symbols are included in the symbol index
  symbolFilter?: {
    // Exclude specific kinds by name (case-sensitive, matches LSP SymbolKind names)
    // Valid names include: "File","Module","Namespace","Package","Class","Method",
    // "Property","Field","Constructor","Enum","Interface","Function","Variable",
    // "Constant","String","Number","Boolean","Array","Object","Key","Null",
    // "EnumMember","Struct","Event","Operator","TypeParameter"
    excludeKinds?: string[];

    // Exclude symbols whose names match any of these patterns
    // - Each entry is treated as a regex if possible, otherwise as a simple substring
    excludePatterns?: string[];

    // Only include top-level symbols (e.g., module/file-level exports)
    includeOnlyTopLevel?: boolean;
  };

  // Additional ignore patterns for indexing (in addition to .gitignore)
  ignorePatterns?: string[];
}
```

Defaults used by the indexer
The indexer loader merges your configuration with the following defaults (source: [`src/indexer/config/configLoader.ts`](src/indexer/config/configLoader.ts)):

```json
{
  "indexFiles": ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  "settings": {
    "indexConcurrency": 5,
    "autoIndex": false,
    "autoIndexDelay": 500,
    "enableWatchers": true,
    "memoryLimit": 1024
  },
  "symbolFilter": {
    "excludeKinds": [
      "Variable",
      "Constant",
      "String",
      "Number",
      "Boolean",
      "Array",
      "Object",
      "Key",
      "Null"
    ],
    "excludePatterns": ["callback", "temp", "tmp", "_", "^[a-z]$"],
    "includeOnlyTopLevel": false
  },
  "ignorePatterns": ["**/node_modules/**", "**/dist/**", "**/.git/**"]
}
```

Examples

TypeScript Project (indexer settings only)

```json
{
  "version": "1.0",
  "indexFiles": ["**/*.ts", "**/*.tsx"],
  "settings": {
    "autoIndex": true,
    "indexConcurrency": 8
  },
  "symbolFilter": {
    "excludeKinds": ["Variable", "Constant"],
    "excludePatterns": ["^_", "temp", "tmp"],
    "includeOnlyTopLevel": true
  },
  "ignorePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.git/**"
  ]
}
```

Including an adapter block (runtime + indexer in one file)
Note: The indexer will ignore unknown fields. The runtime config loader will read adapter fields when this file is passed as the runtime config.

```json
{
  "version": "1.0",
  "indexFiles": ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  "settings": { "indexConcurrency": 5 },
  "adapter": {
    "id": "tsgo",
    "name": "TypeScript (tsgo)",
    "bin": "npx tsgo --lsp --stdio",
    "args": [],
    "baseLanguage": "typescript"
  }
}
```

Using `lsmcp init`
The `lsmcp init` command can generate an initial config based on a preset:

```bash
# TypeScript/JavaScript
lsmcp init -p typescript

# Python
lsmcp init -p pyright

# Rust
lsmcp init -p rust-analyzer

# Go
lsmcp init -p gopls

# F#
lsmcp init -p fsharp
```

Clarifications

- The indexer reads symbolFilter and index settings from `.lsmcp/config.json`.
- Runtime-only toggles for MCP tools (e.g., enabling TypeScript-specific extra tools) are controlled by the MCP runtime configuration path you pass when starting lsmcp. The indexer does not consume those toggles.
