# Release Notes - v0.7.0

We're excited to announce the release of lsmcp v0.7.0! This release brings significant improvements to LSP compatibility, better developer experience, and enhanced documentation.

## 🎉 Highlights

### LocationLink Support for Modern LSP Servers
The biggest improvement in this release is the addition of LocationLink format support. This fixes the "Go to Definition" feature for modern LSP servers like typescript-language-server and rust-analyzer, while maintaining backward compatibility with older servers.

### Simplified Tool Names
We've removed the `lsmcp_` prefix from all tool names, making them shorter and easier to use. This is a breaking change, but it significantly improves the developer experience.

### Enhanced Documentation
The README now includes language-specific installation guides with examples for TypeScript, Rust, F#, and Python, making it easier to get started with your preferred language.

## 🚀 What's New

### Features
- **LocationLink Format Support**: Modern LSP servers like typescript-language-server and rust-analyzer use LocationLink format for navigation features. This release adds full support for this format while maintaining compatibility with the traditional Location format.

### Bug Fixes
- **Diagnostic Messages**: Fixed inconsistency in diagnostic message format - now properly shows "0 errors and 0 warnings" when no issues are found
- **Flaky Tests**: Added retry mechanism for integration tests to handle timing-sensitive LSP operations in CI environments
- **Build Process**: Removed unnecessary build steps from tests to prevent race conditions

### Documentation
- Added language-specific installation guides for TypeScript, Rust, F#, and Python
- Included both `claude mcp add` and `.mcp.json` configuration examples
- Updated all documentation to use English consistently

## 💥 Breaking Changes

### Tool Name Changes
All MCP tool names have been simplified by removing the `lsmcp_` prefix:

| Old Name | New Name |
|----------|----------|
| `lsmcp_get_hover` | `get_hover` |
| `lsmcp_find_references` | `find_references` |
| `lsmcp_get_definitions` | `get_definitions` |
| `lsmcp_get_diagnostics` | `get_diagnostics` |
| `lsmcp_rename_symbol` | `rename_symbol` |
| `lsmcp_delete_symbol` | `delete_symbol` |
| ... and all other tools | ... follow the same pattern |

To update your configuration:
1. Update your `.mcp.json` file to use the new tool names
2. Update any scripts or automation that reference the old tool names

## 📦 Installation

### Using Claude CLI
```bash
# TypeScript/JavaScript
claude mcp add npx -y @mizchi/lsmcp --language=typescript

# Rust
claude mcp add npx -y @mizchi/lsmcp --bin=rust-analyzer

# Python
claude mcp add npx -y @mizchi/lsmcp --bin=pylsp

# F#
claude mcp add npx -y @mizchi/lsmcp --language=fsharp
```

### Using .mcp.json
```json
{
  "mcpServers": {
    "lsmcp": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "--language=typescript"]
    }
  }
}
```

## 🔄 Upgrading from v0.6.x

1. Update to v0.7.0:
   ```bash
   npm update @mizchi/lsmcp
   ```

2. Update your tool references to use the new names (remove `lsmcp_` prefix)

3. If you're using typescript-language-server, "Go to Definition" should now work correctly without any additional configuration

## 🙏 Acknowledgments

Thank you to all contributors and users who reported issues and provided feedback. Special thanks to those who helped test the LocationLink format support across different LSP servers.

## 📚 Resources

- [GitHub Repository](https://github.com/mizchi/lsmcp)
- [Documentation](https://github.com/mizchi/lsmcp#readme)
- [Issue Tracker](https://github.com/mizchi/lsmcp/issues)

---

For the complete list of changes, see the [CHANGELOG](https://github.com/mizchi/lsmcp/blob/main/CHANGELOG.md).