# LSMCP Configuration Schema

The `.lsmcp/config.json` file configures the LSMCP language server and indexing behavior for your project.

## Schema Version

Current version: `1.0`

## Complete Schema

```typescript
interface LSMCPConfig {
  // Required: Config file format version
  version: "1.0";
  
  // Glob patterns for files to index
  indexFiles: string[];
  
  // Language adapter configuration (expanded from preset)
  adapter?: {
    // Unique identifier for the adapter
    id: string;
    
    // Display name
    name: string;
    
    // LSP server binary path or command
    bin: string;
    
    // Arguments for the LSP server
    args: string[];
    
    // Base language ID (e.g., 'typescript')
    baseLanguage?: string;
    
    // Description of the adapter
    description?: string;
    
    // List of unsupported MCP tools
    unsupported?: string[];
    
    // Language-specific initialization options
    initializationOptions?: any;
    
    // Server characteristics
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
  
  // Additional settings
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
  
  // Additional ignore patterns for indexing (in addition to .gitignore)
  ignorePatterns?: string[];
}
```

## Default Configuration

```json
{
  "version": "1.0",
  "indexFiles": ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  "settings": {
    "autoIndex": false,
    "indexConcurrency": 5,
    "autoIndexDelay": 500,
    "enableWatchers": true,
    "memoryLimit": 1024
  },
  "ignorePatterns": ["**/node_modules/**", "**/dist/**", "**/.git/**"]
}
```

## Examples

### TypeScript Project

```json
{
  "version": "1.0",
  "indexFiles": ["**/*.ts", "**/*.tsx"],
  "adapter": {
    "id": "typescript",
    "name": "TypeScript Language Server",
    "bin": "typescript-language-server",
    "args": ["--stdio"],
    "baseLanguage": "typescript"
  },
  "ignorePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.git/**"
  ]
}
```

### Python Project

```json
{
  "version": "1.0",
  "indexFiles": ["**/*.py"],
  "adapter": {
    "id": "pyright",
    "name": "Pyright",
    "bin": "pyright-langserver",
    "args": ["--stdio"],
    "baseLanguage": "python"
  }
}
```

### Rust Project

```json
{
  "version": "1.0",
  "indexFiles": ["**/*.rs"],
  "adapter": {
    "id": "rust-analyzer",
    "name": "rust-analyzer",
    "bin": "rust-analyzer",
    "args": [],
    "baseLanguage": "rust"
  }
}
```

## Using `lsmcp init`

The `lsmcp init` command automatically generates a config.json based on the preset:

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

## Future Plans

In future versions, we plan to support:
- Multiple LSP adapters in a single project (e.g., TypeScript + Python)
- Per-directory adapter configuration
- Dynamic adapter switching based on file type