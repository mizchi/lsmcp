/**
 * Default configuration values for lsmcp
 * These values are used when no configuration is provided
 */

import type { LSMCPConfig } from "./configSchema.ts";

/**
 * Minimal default configuration - users only need to override what they need
 */
export const DEFAULT_BASE_CONFIG: Partial<LSMCPConfig> = {
  version: "1.0",
  indexFiles: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
  settings: {
    autoIndex: false,
    indexConcurrency: 5,
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

/**
 * Default adapter configuration for TypeScript
 */
export const DEFAULT_TYPESCRIPT_ADAPTER = {
  id: "tsgo",
  name: "tsgo",
  baseLanguage: "typescript",
  description: "Fast TypeScript language server by tsgo",
  bin: "npx",
  args: ["-y", "tsgo", "--lsp", "--stdio"],
  unsupported: [
    "get_workspace_symbols",
    "get_code_actions",
    "rename_symbol",
    "delete_symbol",
  ],
  initializationOptions: {
    preferences: {
      includeInlayParameterNameHints: "none",
      includeInlayParameterNameHintsWhenArgumentMatchesName: false,
      includeInlayFunctionParameterTypeHints: false,
      includeInlayVariableTypeHints: false,
      includeInlayPropertyDeclarationTypeHints: false,
      includeInlayFunctionLikeReturnTypeHints: false,
      includeInlayEnumMemberValueHints: false,
    },
    maxTsServerMemory: 4096,
  },
};

/**
 * Merge configurations with deep merging for nested objects
 */
export function mergeConfigs(
  base: Partial<LSMCPConfig>,
  override: Partial<LSMCPConfig>,
): LSMCPConfig {
  const result = { ...base } as LSMCPConfig;

  // Deep merge settings
  if (override.settings) {
    result.settings = {
      ...base.settings,
      ...override.settings,
    };
  }

  // Deep merge symbolFilter
  if (override.symbolFilter) {
    result.symbolFilter = {
      ...base.symbolFilter,
      ...override.symbolFilter,
    };
  }

  // Deep merge lsp configuration
  if (override.lsp) {
    if (base.lsp) {
      result.lsp = {
        ...base.lsp,
        ...override.lsp,
        // Deep merge serverCapabilities if present
        serverCapabilities: override.lsp.serverCapabilities
          ? {
              ...base.lsp.serverCapabilities,
              ...override.lsp.serverCapabilities,
            }
          : base.lsp.serverCapabilities,
        // Deep merge initializationOptions
        initializationOptions: {
          ...base.lsp.initializationOptions,
          ...override.lsp?.initializationOptions,
        },
      };
    } else {
      result.lsp = override.lsp;
    }
  }

  // Deep merge adapter (legacy - for backward compatibility)
  if (override.adapter) {
    if (base.adapter) {
      result.adapter = {
        ...base.adapter,
        ...override.adapter,
        // Deep merge serverCapabilities if present
        serverCapabilities: override.adapter.serverCapabilities
          ? {
              ...base.adapter.serverCapabilities,
              ...override.adapter.serverCapabilities,
            }
          : base.adapter.serverCapabilities,
        // Deep merge initializationOptions
        initializationOptions: {
          ...base.adapter.initializationOptions,
          ...override.adapter?.initializationOptions,
        },
      };
    } else {
      result.adapter = override.adapter;
    }
  }

  // Override arrays completely (don't merge)
  if (override.indexFiles !== undefined) {
    result.indexFiles = override.indexFiles;
  }
  if (override.ignorePatterns !== undefined) {
    result.ignorePatterns = override.ignorePatterns;
  }

  // Override version
  if (override.version !== undefined) {
    result.version = override.version;
  }

  return result;
}

/**
 * Get adapter configuration from preset name
 */
export function getAdapterFromPreset(preset: string): any {
  // Map preset names to adapter configurations
  const presets: Record<string, any> = {
    tsgo: DEFAULT_TYPESCRIPT_ADAPTER,
    typescript: {
      id: "typescript",
      name: "typescript-language-server",
      baseLanguage: "typescript",
      description: "TypeScript Language Server",
      bin: "typescript-language-server",
      args: ["--stdio"],
    },
    "rust-analyzer": {
      id: "rust-analyzer",
      name: "rust-analyzer",
      baseLanguage: "rust",
      description: "Rust Language Server",
      bin: "rust-analyzer",
      args: [],
    },
    pyright: {
      id: "pyright",
      name: "pyright",
      baseLanguage: "python",
      description: "Python Language Server",
      bin: "pyright-langserver",
      args: ["--stdio"],
    },
    gopls: {
      id: "gopls",
      name: "gopls",
      baseLanguage: "go",
      description: "Go Language Server",
      bin: "gopls",
      args: ["serve"],
    },
  };

  return presets[preset];
}

/**
 * Create a complete configuration from partial user config
 */
export function createCompleteConfig(
  userConfig?: Partial<LSMCPConfig>,
): LSMCPConfig {
  if (!userConfig) {
    // If no user config, return default with TypeScript adapter
    return mergeConfigs(DEFAULT_BASE_CONFIG, {
      lsp: DEFAULT_TYPESCRIPT_ADAPTER,
      adapter: DEFAULT_TYPESCRIPT_ADAPTER, // Keep for backward compatibility
    });
  }

  let finalConfig = { ...DEFAULT_BASE_CONFIG } as any;

  // Handle preset field
  if (userConfig.preset && !userConfig.lsp && !userConfig.adapter) {
    const presetAdapter = getAdapterFromPreset(userConfig.preset);
    if (presetAdapter) {
      finalConfig.lsp = presetAdapter;
      finalConfig.adapter = presetAdapter; // Mirror to adapter for compatibility
    }
  }

  // Handle new 'lsp' field
  if (userConfig.lsp) {
    // User's lsp config overrides preset, but we may need to add id/name from preset
    const presetAdapter = userConfig.preset
      ? getAdapterFromPreset(userConfig.preset)
      : null;
    if (presetAdapter) {
      // Merge preset values with user's lsp config
      finalConfig.lsp = {
        id: presetAdapter.id,
        name: presetAdapter.name,
        baseLanguage: presetAdapter.baseLanguage,
        description: presetAdapter.description,
        ...userConfig.lsp,
      };
      finalConfig.adapter = finalConfig.lsp;
    } else {
      // Use user's lsp config as-is, add default id/name if missing
      finalConfig.lsp = {
        id: "custom",
        name: "Custom LSP",
        ...userConfig.lsp,
      };
      finalConfig.adapter = finalConfig.lsp;
    }
  }
  // Handle legacy 'adapter' field for backward compatibility
  else if (userConfig.adapter) {
    // If adapter.id is provided without other fields, try to expand from preset
    if (userConfig.adapter.id && !userConfig.adapter.name) {
      const presetAdapter = getAdapterFromPreset(userConfig.adapter.id);
      if (presetAdapter) {
        finalConfig.lsp = { ...presetAdapter, ...userConfig.adapter };
        finalConfig.adapter = finalConfig.lsp;
      } else {
        finalConfig.lsp = userConfig.adapter;
        finalConfig.adapter = userConfig.adapter;
      }
    } else {
      finalConfig.lsp = userConfig.adapter;
      finalConfig.adapter = userConfig.adapter;
    }
  }

  // If still no LSP config, use TypeScript default
  if (!finalConfig.lsp) {
    finalConfig.lsp = DEFAULT_TYPESCRIPT_ADAPTER;
    finalConfig.adapter = DEFAULT_TYPESCRIPT_ADAPTER;
  }

  // Merge the rest of the config
  return mergeConfigs(finalConfig, userConfig);
}
