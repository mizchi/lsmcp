# Language-Specific Features Configuration

## Overview

LSMCP supports language-specific features that can be selectively enabled based on your project needs. This allows you to optimize the tool's performance and functionality for your specific use case.

## Configuration

Language-specific features are configured in the `.lsmcp/config.json` file under the `languageFeatures` section.

### Default Configuration

#### Preset-based Defaults

When using certain presets, language-specific features are **automatically enabled**:

- **`tsgo` preset**: TypeScript features are enabled by default
- **`typescript` preset**: TypeScript features are enabled by default  
- **`rust-analyzer` preset**: Rust features are enabled by default

For other presets or custom configurations, language-specific features are disabled by default.

```json
{
  "$schema": "https://raw.githubusercontent.com/mizchi/lsmcp/main/schema.json",
  "version": "1.0",
  "languageFeatures": {
    "typescript": {
      "enabled": false,
      "indexNodeModules": true,
      "maxFiles": 5000
    },
    "rust": {
      "enabled": false,
      "indexCargo": true
    },
    "go": {
      "enabled": false,
      "indexGoModules": true
    },
    "python": {
      "enabled": false,
      "indexSitePackages": true
    }
  }
}
```

## TypeScript Features

When TypeScript features are enabled, the following tools become available:

### Tools
- `index_external_libraries` - Index TypeScript declaration files from node_modules
- `get_typescript_dependencies` - List available TypeScript dependencies
- `search_external_library_symbols` - Search for symbols in indexed external libraries
- `resolve_symbol` - Resolve import statements to their definitions
- `get_available_external_symbols` - Get all symbols available from imports
- `parse_imports` - Parse and analyze import statements

### Configuration Options

```json
{
  "languageFeatures": {
    "typescript": {
      "enabled": true,
      "indexNodeModules": true,    // Index node_modules dependencies
      "maxFiles": 5000             // Maximum files to index from node_modules
    }
  }
}
```

### Use Cases
- Analyzing external library usage
- Understanding dependencies
- Symbol resolution across packages
- Import optimization

## Rust Features (Planned)

When Rust features are enabled, the following capabilities will be available:

### Configuration Options

```json
{
  "languageFeatures": {
    "rust": {
      "enabled": true,
      "indexCargo": true    // Index Cargo dependencies
    }
  }
}
```

### Planned Features
- Index crates from Cargo.toml
- Search symbols in external crates
- Resolve use statements
- Analyze crate dependencies

## Go Features (Planned)

When Go features are enabled, the following capabilities will be available:

### Configuration Options

```json
{
  "languageFeatures": {
    "go": {
      "enabled": true,
      "indexGoModules": true    // Index Go module dependencies
    }
  }
}
```

### Planned Features
- Index Go modules from go.mod
- Search symbols in external packages
- Resolve import statements
- Analyze module dependencies

## Python Features (Planned)

When Python features are enabled, the following capabilities will be available:

### Configuration Options

```json
{
  "languageFeatures": {
    "python": {
      "enabled": true,
      "indexSitePackages": true    // Index site-packages dependencies
    }
  }
}
```

### Planned Features
- Index Python packages from requirements.txt/pyproject.toml
- Search symbols in external packages
- Resolve import statements
- Analyze package dependencies

## Performance Considerations

### Memory Usage
- Each enabled language feature increases memory usage
- TypeScript indexing can use significant memory for large node_modules
- Consider the `maxFiles` option to limit indexing scope

### Indexing Time
- Initial indexing of external libraries can take time
- Subsequent searches are fast due to caching
- Enable only the languages you actively use

### Best Practices
1. Enable language features only for languages used in your project
2. Adjust `maxFiles` based on your system's memory
3. Use incremental indexing for better performance
4. Clear the index periodically if it grows too large

## Example Configurations

### Using Presets (Automatic Enablement)

When using the `tsgo` preset, TypeScript features are automatically enabled:

```json
{
  "preset": "tsgo"
  // TypeScript features are automatically enabled
}
```

Similarly for Rust projects:

```json
{
  "preset": "rust-analyzer"
  // Rust features are automatically enabled
}
```

### Manual Configuration

For explicit control over features:

```json
{
  "languageFeatures": {
    "typescript": {
      "enabled": true,
      "indexNodeModules": true,
      "maxFiles": 3000
    }
  }
}
```

### Disabling Preset Defaults

To use a preset but disable its default language features:

```json
{
  "preset": "tsgo",
  "languageFeatures": {
    "typescript": {
      "enabled": false
    }
  }
}
```

### Multi-Language Project (Future)

```json
{
  "languageFeatures": {
    "typescript": {
      "enabled": true,
      "indexNodeModules": true,
      "maxFiles": 2000
    },
    "rust": {
      "enabled": true,
      "indexCargo": true
    },
    "go": {
      "enabled": true,
      "indexGoModules": true
    }
  }
}
```

### Minimal Configuration (Default)

```json
{
  "languageFeatures": {}
}
```

All language-specific features are disabled by default for optimal performance.

## Migration Guide

If you're upgrading from a version where TypeScript features were always enabled:

1. Add the `languageFeatures` section to your config
2. Enable TypeScript features explicitly if needed
3. Adjust `maxFiles` based on your project size

```json
{
  "languageFeatures": {
    "typescript": {
      "enabled": true
    }
  }
}
```

## Troubleshooting

### Tools Not Available
- Check that the language feature is enabled in config
- Restart the MCP server after config changes

### High Memory Usage
- Reduce `maxFiles` for TypeScript
- Disable unused language features
- Clear the index with `clear_index` tool

### Slow Indexing
- Reduce the scope with `maxFiles`
- Use `.gitignore` patterns to exclude unnecessary files
- Enable only needed language features