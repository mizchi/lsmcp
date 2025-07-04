# lsmcp - Language Service MCP

**LSP for headless AI Agents**

[![CI - Unit Tests](https://github.com/mizchi/lsmcp/actions/workflows/ci-unit.yml/badge.svg)](https://github.com/mizchi/lsmcp/actions/workflows/ci-unit.yml)
[![CI - Integration Tests](https://github.com/mizchi/lsmcp/actions/workflows/ci-integration.yml/badge.svg)](https://github.com/mizchi/lsmcp/actions/workflows/ci-integration.yml)
[![CI - Language Adapters](https://github.com/mizchi/lsmcp/actions/workflows/ci-adapters.yml/badge.svg)](https://github.com/mizchi/lsmcp/actions/workflows/ci-adapters.yml)

> ⚠️ **This project is under active development.** APIs and features may change without notice.

A unified MCP (Model Context Protocol) server that provides advanced code manipulation and analysis capabilities for multiple programming languages through Language Server Protocol integration.

## Features

- 🌍 **Multi-Language Support** - Built-in TypeScript/JavaScript, extensible to any language via LSP
- 🔍 **Semantic Code Analysis** - Go to definition, find references, type information
- 🤖 **AI-Optimized** - Designed for LLMs with line and symbol-based interfaces

### LSP Tools (Language Server Protocol)

These tools work with any language that has an LSP server:

- **get_hover** - Get hover information (type signature, documentation) using LSP
- **find_references** - Find all references to symbol across the codebase using LSP
- **get_definitions** - Get the definition(s) of a symbol using LSP
- **get_diagnostics** - Get diagnostics (errors, warnings) for a file using LSP
- **get_all_diagnostics** - Get diagnostics (errors, warnings) for all files in the project
- **rename_symbol** - Rename a symbol across the codebase using Language Server Protocol
- **delete_symbol** - Delete a symbol and optionally all its references using LSP
- **get_document_symbols** - Get all symbols (functions, classes, variables, etc.) in a document using LSP
- **get_workspace_symbols** - Search for symbols across the entire workspace using LSP
- **get_completion** - Get code completion suggestions at a specific position using LSP
- **get_signature_help** - Get signature help (parameter hints) for function calls using LSP
- **get_code_actions** - Get available code actions (quick fixes, refactorings, etc.) using LSP
- **format_document** - Format an entire document using the language server's formatting provider

See [examples/](examples/) for working examples of each supported language configuration.

## Quick Start

lsmcp provides multi-language support through Language Server Protocol (LSP) integration. The basic workflow is:

1. **Install Language Server** - Install the LSP server for your target language
2. **Add MCP Server** - Configure using `claude mcp add` command or `.mcp.json`

### Basic Usage

```bash
# Using presets for common languages
claude mcp add typescript npx -- -y @mizchi/lsmcp -p typescript

# Custom LSP server with --bin
claude mcp add <server-name> npx -- -y @mizchi/lsmcp --bin="<lsp-command>"
```

### Available Presets

lsmcp includes built-in presets for popular language servers:

- **`typescript`** - TypeScript/JavaScript (typescript-language-server)
- **`tsgo`** - TypeScript/JavaScript (tsgo - faster alternative)
- **`deno`** - Deno TypeScript/JavaScript
- **`pyright`** - Python (Microsoft Pyright)
- **`ruff`** - Python (Ruff linter as LSP)
- **`rust-analyzer`** - Rust
- **`fsharp`** - F# (fsautocomplete)
- **`moonbit`** - MoonBit
- **`gopls`** - Go (Official Go language server)

For languages not in this list, or to customize LSP server settings, see [Manual Setup](#manual-setup).

### Language-Specific Setup

#### TypeScript

<details>
<summary>TypeScript Setup</summary>

```bash
# with typeScript-language-server (stable)
npm add -D typescript typescript-language-server
# Recommended: use tsgo for full functionality
claude mcp add typescript npx -- -y @mizchi/lsmcp -p typescript --bin="npx tsgo --lsp --stdio"

# with @typescript/native-preview (experimental, fast)
npm add -D @typescript/native-preview
claude mcp add typescript npx -- -y @mizchi/lsmcp -p typescript --bin="npx tsgo"
```

Manual Configuration (.mcp.json)

```json
{
  "mcpServers": {
    "typescript": {
      "command": "npx",
      "args": [
        "-y",
        "@mizchi/lsmcp",
        "-p",
        "typescript",
        "--bin",
        "npx tsgo --lsp --stdio"
      ]
    }
  }
}
```

</details>

#### Rust

<details>
<summary>Rust Setup</summary>

```bash
rustup component add rust-analyzer
claude mcp add rust npx -- -y @mizchi/lsmcp -p rust-analyzer
```

Manual Configuration (.mcp.json)

```json
{
  "mcpServers": {
    "rust": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "-p", "rust-analyzer"]
    }
  }
}
```

See [examples/rust-project/](examples/rust-project/) for a complete example.

</details>

#### Go

<details>
<summary>Go Setup</summary>

```bash
# Install gopls (official Go language server)
go install golang.org/x/tools/gopls@latest
claude mcp add go npx -- -y @mizchi/lsmcp -p gopls
```

Manual Configuration (.mcp.json)

```json
{
  "mcpServers": {
    "go": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "-p", "gopls"]
    }
  }
}
```

See [examples/go/](examples/go/) for a complete example.

</details>

#### F#

<details>
<summary>F# Setup</summary>

```bash
dotnet tool install -g fsautocomplete
claude mcp add fsharp npx -- -y @mizchi/lsmcp -p fsharp --bin="fsautocomplete --adaptive-lsp-server-enabled"
```

Manual Configuration (.mcp.json)

```json
{
  "mcpServers": {
    "fsharp": {
      "command": "npx",
      "args": [
        "-y",
        "@mizchi/lsmcp",
        "-p",
        "fsharp",
        "--bin",
        "fsautocomplete"
      ]
    }
  }
}
```

See [examples/fsharp-project/](examples/fsharp-project/) for a complete example.

</details>

#### Python

<details>
<summary>Python Setup</summary>

```bash
# Option 1: Using Pyright (recommended)
npm install -g pyright
claude mcp add python npx -- -y @mizchi/lsmcp -p pyright

# Option 2: Using python-lsp-server
pip install python-lsp-server
claude mcp add python npx -- -y @mizchi/lsmcp --bin="pylsp"
```

Manual Configuration (.mcp.json)

```json
{
  "mcpServers": {
    "python": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "-p", "pyright"]
    }
  }
}
```

See [examples/python-project/](examples/python-project/) for a complete example.

</details>

#### Other Languages

<details>
<summary>Other Language Support</summary>

lsmcp supports any language with an LSP server. Here are some common configurations:

```bash
# Go
go install golang.org/x/tools/gopls@latest
claude mcp add go npx -- -y @mizchi/lsmcp --bin="gopls"

# C/C++ 
# Install clangd from your package manager or LLVM releases
claude mcp add cpp npx -- -y @mizchi/lsmcp --bin="clangd"

# Java
# Install jdtls (Eclipse JDT Language Server)
claude mcp add java npx -- -y @mizchi/lsmcp --bin="jdtls"
```

For more customization options, see [Manual Setup](#manual-setup).

</details>

## Manual Setup

For advanced users who want more control over LSP server configuration, you can set up lsmcp manually with custom settings.

### Minimal rust-analyzer Example

```json
{
  "mcpServers": {
    "rust-minimal": {
      "command": "npx",
      "args": [
        "-y",
        "@mizchi/lsmcp",
        "--bin",
        "rust-analyzer"
      ],
      "env": {
        "RUST_ANALYZER_CONFIG": "{\"assist\":{\"importGranularity\":\"module\"},\"cargo\":{\"allFeatures\":true}}"
      }
    }
  }
}
```

### Custom Language Server Setup

You can configure any LSP server by providing the binary path and optional initialization options:

```json
{
  "mcpServers": {
    "custom-lsp": {
      "command": "npx",
      "args": [
        "-y",
        "@mizchi/lsmcp",
        "--bin",
        "/path/to/your/lsp-server",
        "--initializationOptions",
        "{\"customOption\":\"value\"}"
      ]
    }
  }
}
```

### Using Configuration Files

For complex LSP server configurations, you can use the `--config` option to load settings from a JSON file:

1. Create a configuration file (e.g., `my-language.json`):

```json
{
  "id": "my-language",
  "name": "My Custom Language",
  "bin": "my-language-server",
  "args": ["--stdio"],
  "initializationOptions": {
    "formatOnSave": true,
    "lintingEnabled": true,
    "customFeatures": {
      "autoImport": true
    }
  }
}
```

2. Use it with lsmcp:

```bash
# Using Claude CLI
claude mcp add my-language npx -- -y @mizchi/lsmcp --config ./my-language.json

# Or in .mcp.json
{
  "mcpServers": {
    "my-language": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "--config", "./my-language.json"]
    }
  }
}
```

This approach is useful when:
- You have complex initialization options
- You want to share configurations across projects
- You need to version control your LSP settings

### Environment Variables

Some LSP servers can be configured via environment variables:

```json
{
  "mcpServers": {
    "configured-lsp": {
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "--bin", "lsp-server"],
      "env": {
        "LSP_LOG_LEVEL": "debug",
        "LSP_WORKSPACE": "/path/to/workspace"
      }
    }
  }
}
```

## MCP Usage

### Command Line Options

```bash
# Using language presets
npx @mizchi/lsmcp -p <preset> --bin '...'
npx @mizchi/lsmcp --preset <preset> --bin '...'

# Custom LSP server
npx @mizchi/lsmcp --bin '<lsp-command>'
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

See [CLAUDE.md](CLAUDE.md) for development guidelines.

## Troubleshooting

<details>
<summary>Common Issues</summary>

### LSP Server Not Found

```
Error: LSP server for typescript not found
```

**Solution**: Install the language server:

```bash
npm add typescript typescript-language-server
```

### Permission Denied

```
Error: Permission denied for tool 'rename_symbol'
```

**Solution**: Update `.claude/settings.json` to allow lsmcp tools.

### Empty Diagnostics

If `get_diagnostics` returns empty results:

1. Ensure the language server is running: `ps aux | grep language-server`
2. Check for tsconfig.json or equivalent config file
3. Try opening the file first with `get_hover`

</details>

## License

MIT - See [LICENSE](LICENSE) file for details.
