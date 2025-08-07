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

### Core Tools

#### Symbol Indexing & Search
- **index_symbols** - Build/update symbol index with smart incremental updates based on git changes
- **search_symbol_from_index** - Fast search for symbols by name, kind, file, or container
- **get_index_stats_from_index** - Get statistics about the symbol index
- **clear_index** - Clear the symbol index and free memory

#### LSP Tools (Language Server Protocol)
- **get_hover** - Get hover information (type signature, documentation) using LSP
- **find_references** - Find all references to symbol across the codebase using LSP
- **get_definitions** - Get the definition(s) of a symbol using LSP
- **get_diagnostics** - Get diagnostics (errors, warnings) for a file using LSP
- **get_all_diagnostics** - Get diagnostics for all files matching a pattern
- **get_document_symbols** - Get all symbols in a document with hierarchical structure
- **get_workspace_symbols** - Search for symbols across the entire workspace using LSP
- **get_completion** - Get code completion suggestions at a specific position using LSP
- **get_signature_help** - Get signature help (parameter hints) for function calls using LSP
- **format_document** - Format an entire document using the language server's formatting provider

#### Code Editing Tools
- **replace_symbol_body** - Replace the entire body of a symbol
- **insert_before_symbol** - Insert content before a symbol definition
- **insert_after_symbol** - Insert content after a symbol definition
- **replace_regex** - Replace content using regular expressions with dotall and multiline flags

#### Memory System
- **list_memories** - List available memories for the current project
- **read_memory** - Read a specific memory from the project
- **write_memory** - Write or update a memory for the project
- **delete_memory** - Delete a memory from the project

#### File System Tools
- **list_dir** - List files and directories in a given path
- **find_file** - Find files matching a pattern within a directory
- **search_for_pattern** - Search for regex patterns in the codebase
- **get_symbols_overview** - Get an overview of symbols in a file or directory

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
claude mcp add typescript npx -- -y @mizchi/lsmcp -p typescript

# with @typescript/native-preview (experimental, fast)
npm add -D @typescript/native-preview
claude mcp add typescript npx -- -y @mizchi/lsmcp -p tsgo
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
        "typescript"
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

### Configuration with JSON Schema

lsmcp provides a JSON Schema for configuration files that enables validation and auto-completion in VS Code and other editors.

First, install lsmcp as a dev dependency:

```bash
pnpm add @mizchi/lsmcp -D
```

Then add the `$schema` field to your `.lsmcp/config.json`:

```json
{
  "$schema": "../node_modules/@mizchi/lsmcp/lsmcp.schema.json",
  "preset": "tsgo",
  "settings": {
    "autoIndex": true,
    "indexConcurrency": 10
  }
}
```

Available configuration options:
- **preset** - Preset language adapter (tsgo, typescript, rust-analyzer, pyright, gopls, etc.)
- **indexFiles** - Glob patterns for files to index
- **lsp** - Custom LSP server configuration (bin, args, initializationOptions)
- **settings** - LSMCP settings (autoIndex, indexConcurrency, enableWatchers, etc.)
- **symbolFilter** - Symbol filtering options (excludeKinds, excludePatterns)
- **ignorePatterns** - Additional patterns to ignore during indexing

See the complete schema at `node_modules/@mizchi/lsmcp/lsmcp.schema.json` after installation.

For a comprehensive configuration example, see [examples/full-lsmcp-config.json](examples/full-lsmcp-config.json).

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

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development setup, testing instructions, and contribution guidelines.

```bash
# Quick start
pnpm install
pnpm build
pnpm test
```

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
